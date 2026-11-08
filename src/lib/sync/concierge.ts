import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { createGoogle } from "@ai-sdk/google";
import { generateText } from "ai";
import {
  writeToGoogleCalendar,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  eventGcalId,
} from "@/lib/auth/google-oauth";
import {
  type ExtractedEvent,
  STALE_ANNOUNCEMENT_DAYS,
  isStaleAnnouncement,
  keepExtractedEvent,
  normalizeEventTitle,
  isValidDate,
  shiftEndForNewStart,
} from "@/lib/events/helpers";
import { deriveTitle, sanitizeTitle, sanitizeSummary, classifyEventType } from "./shared";

// Autonomous "concierge" pass: reads recent announcements with Gemini and turns them into
// calendar events, saved resources, titles, and summaries. Returns how many AI calls failed.
export async function runConcierge(db: ReturnType<typeof createServerClient>): Promise<number> {
  let aiErrors = 0;
  try {
    const { data: geminiPlatform } = await db
      .from("platforms")
      .select("access_token, is_connected")
      .eq("type", "gemini")
      .maybeSingle();

    const apiKey =
      geminiPlatform?.is_connected && geminiPlatform?.access_token
        ? geminiPlatform.access_token
        : process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (apiKey) {
      const googleProvider = createGoogle({ apiKey });

      const { data: anns } = await db
        .from("announcements")
        .select("id, content, announced_at, platform_id")
        .order("announced_at", { ascending: false })
        .limit(12);

      if (anns && anns.length > 0) {
        for (const ann of anns) {
          const { data: existingAction } = await db
            .from("agent_actions")
            .select("id")
            .eq("source_id", ann.id)
            .limit(1)
            .maybeSingle();

          if (existingAction) continue;

          if (isStaleAnnouncement(ann.announced_at, new Date())) {
            try {
              await db.from("agent_actions").insert({
                title: "Skipped stale announcement",
                description: `Announcement posted ${ann.announced_at} is older than ${STALE_ANNOUNCEMENT_DAYS} days — no events scheduled from it.`,
                action_type: "sync",
                source_id: ann.id,
              });
            } catch {}
            continue;
          }

          const nowIso = new Date().toISOString();
          const prompt = `You are the autonomous Nexus AI Concierge Agent. Read this university announcement in FULL and extract EVERYTHING useful for a student's academic organizer.

  Announcement posted at: ${ann.announced_at ?? "unknown"}
  Current date: ${nowIso}

  Announcement content:
  "${ann.content}"

  Extract ALL of the following — be exhaustive, never stop after the first match:
  - summary: A short, easy-to-read summary (2–4 sentences, plain language, no markdown) of the announcement's key points so a student can skim it at a glance. Lead with what matters most. Preserve concrete details (rooms, times, dates, names).
  - title: A concise, human-readable headline for the whole announcement (max ~8 words), plain text only — no markdown, quotes, or emoji.
  - events: EVERY deadline or scheduled occurrence — every quiz, exam, midterm, final, assignment/homework/project submission, office hour, review session, or meeting. Assignment submission deadlines MUST use event_type "assignment"; quizzes "quiz"; exams/midterms/finals "exam"; other scheduled items "other". If a date/time range is given, set end_time too.
  Each event carries an "action":
  - "create": a newly announced deadline or occurrence.
  - "update": the announcement MOVES or CHANGES an already-known event (words like "moved to", "postponed", "rescheduled", "new date", "changed to"). Use the event's original name as title and the NEW date/time as start_time.
  - "cancel": the announcement CANCELS an event ("cancelled", "called off", "will not take place", "no quiz this week"). Use the cancelled event's name as title; start_time may be an empty string.
  - resources: EVERY distinct URL (Google Docs, Drive, Forms, PDFs, slides, syllabus, repo, video, website) as a resource. Use the link's visible label as the title when present; otherwise infer a short title from context. Add a one-line description of what the link is.
  - key_dates: An array of {label, date} for ANY standalone important dates mentioned even if they don't become calendar events (e.g. "Reading due", "Drop deadline"). Use ISO 8601 dates. Empty array if none.

  Date rules (CRITICAL):
  - Resolve ALL relative dates ("today", "tomorrow", "Wednesday", "next week") against the ANNOUNCEMENT POSTED date above — NOT the current date. An announcement saying "quiz on Wednesday" means the Wednesday right after it was posted.
  - start_time and end_time MUST be full ISO 8601 WITH an explicit UTC offset (e.g. "2026-07-15T23:59:00+06:00" or "2026-07-15T17:59:00Z"). Never emit a naive timestamp.
  - If only a date is given, use 23:59 in the announcement's local timezone; if the timezone is unknown, use the announcement posted time's offset.

  Rules:
  - A single announcement often bundles MULTIPLE items (e.g. a quiz AND an assignment, plus several links). Capture EVERY one as its own array entry.
  - Respond ONLY with a valid JSON object matching this TypeScript type:
  {
  summary: string;
  title: string;
  events: Array<{
    action: "create" | "update" | "cancel";
    title: string;
    description: string;
    event_type: "exam" | "quiz" | "assignment" | "other";
    start_time: string; // ISO 8601 with offset; empty string only for action "cancel"
    end_time: string;   // ISO 8601 with offset, or empty string when not stated.
  }>;
  resources: Array<{
    title: string;
    url: string;
    description: string;
  }>;
  key_dates: Array<{ label: string; date: string }>
  }
  - Use empty arrays when there are no events, resources, or key_dates.
  - Do not add markdown backticks or any wrapper — return raw JSON string.`;

          try {
            const { text } = await generateText({
              model: googleProvider("gemini-flash-latest"),
              prompt,
            });
            const cleanText = text
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            const result = JSON.parse(cleanText);

            const aiTitle = sanitizeTitle(result.title);
            const aiSummary = sanitizeSummary(result.summary);
            const patch: Record<string, unknown> = {};
            if (aiTitle) patch.title = aiTitle;
            if (aiSummary) patch.ai_summary = aiSummary;
            if (Object.keys(patch).length > 0) {
              await db.from("announcements").update(patch).eq("id", ann.id);
            }

            const rawEvents: ExtractedEvent[] = Array.isArray(result.events)
              ? result.events
              : result.event
                ? [result.event]
                : [];
            const rawResources: { title?: string; url?: unknown; description?: string }[] =
              Array.isArray(result.resources)
                ? result.resources
                : result.resource
                  ? [result.resource]
                  : [];
            const rawKeyDates: { label?: string; date?: string }[] = Array.isArray(result.key_dates)
              ? result.key_dates
              : [];

            const events = rawEvents
              .filter((e) => e && typeof e.title === "string" && keepExtractedEvent(e, new Date()))
              .map((e) => {
                // keepExtractedEvent guarantees a valid start for everything except cancels,
                // which are matched by title only.
                const start_time = e.start_time as string;
                const endRaw = typeof e.end_time === "string" ? e.end_time.trim() : "";
                const endMs = endRaw ? new Date(endRaw).getTime() : NaN;
                const startMs = new Date(start_time).getTime();
                const end_time = !Number.isNaN(endMs) && endMs > startMs ? endRaw : null;
                return { ...e, start_time, end_time };
              });

            const EVENT_COLS_FULL =
              "id, title, description, event_type, start_time, end_time, source_platform, source_external_id, gcal_event_id, status";
            const scheduled: string[] = [];
            const warnings: string[] = [];

            for (let i = 0; i < events.length; i++) {
              const ev = events[i];
              const action =
                ev.action === "update" || ev.action === "cancel" ? ev.action : "create";
              const eventTitle = ev.title;
              const eventStart = ev.start_time;
              const eventType =
                ev.event_type && ev.event_type !== "other"
                  ? ev.event_type
                  : classifyEventType(eventTitle);

              if (action === "cancel" || action === "update") {
                const { data: candidates } = await db
                  .from("events")
                  .select("id, title, start_time, end_time, gcal_event_id, source_external_id")
                  .eq("event_type", eventType)
                  .neq("status", "cancelled")
                  .gte("start_time", new Date().toISOString());
                const target = (candidates ?? []).find(
                  (c) => normalizeEventTitle(c.title) === normalizeEventTitle(eventTitle)
                );
                if (!target) {
                  warnings.push(
                    `could not find a matching ${eventType} for ${action} "${eventTitle}"`
                  );
                  continue;
                }
                const gid = eventGcalId(target);
                if (action === "cancel") {
                  await db.from("events").update({ status: "cancelled" }).eq("id", target.id);
                  if (gid) await deleteGoogleCalendarEvent(gid);
                  scheduled.push(`cancelled ${eventType} "${target.title}"`);
                } else {
                  const patch: Record<string, unknown> = {};
                  if (ev.description) patch.description = ev.description;
                  if (isValidDate(eventStart)) patch.start_time = eventStart;
                  if (ev.end_time) patch.end_time = ev.end_time;
                  await db.from("events").update(patch).eq("id", target.id);
                  if (gid && patch.start_time) {
                    await updateGoogleCalendarEvent(gid, {
                      startTime: eventStart,
                      endTime:
                        ev.end_time ??
                        shiftEndForNewStart(target.start_time, target.end_time, eventStart),
                      description: ev.description || undefined,
                    });
                  }
                  scheduled.push(
                    `rescheduled ${eventType} "${target.title}" to ${new Date(
                      (patch.start_time as string) ?? target.start_time
                    ).toLocaleDateString()}`
                  );
                }
                continue;
              }

              const autoExternalId = `auto-${ann.id}-${i}`;

              // Run both queries independently to detect all possible conflicts
              const { data: existingByAuto } = await db
                .from("events")
                .select(EVENT_COLS_FULL)
                .eq("source_platform", ann.platform_id)
                .eq("source_external_id", autoExternalId)
                .maybeSingle();

              const { data: contentCandidates } = await db
                .from("events")
                .select(EVENT_COLS_FULL)
                .eq("start_time", eventStart)
                .eq("event_type", eventType)
                .neq("status", "cancelled");

              // Find content match
              const existingByContent = (contentCandidates ?? []).find(
                (c) => normalizeEventTitle(c.title) === normalizeEventTitle(eventTitle)
              );

              // Decide which existing event to prevent (prefer auto-generated ID match)
              const existing = existingByAuto ?? existingByContent;

              if (existing) {
                await db
                  .from("events")
                  .update({
                    description: ev.description,
                    event_type: eventType,
                    end_time: ev.end_time ?? null,
                  })
                  .eq("id", existing.id);
              } else {
                const { data: inserted, error: evError } = await db
                  .from("events")
                  .insert({
                    title: eventTitle,
                    description: ev.description,
                    event_type: eventType,
                    start_time: eventStart,
                    end_time: ev.end_time ?? null,
                    source_platform: ann.platform_id,
                    source_external_id: autoExternalId,
                    is_auto_detected: true,
                  })
                  .select("id")
                  .single();
                if (evError || !inserted) continue;

                try {
                  const googleId = await writeToGoogleCalendar(
                    eventTitle,
                    eventStart,
                    ev.end_time ?? undefined,
                    ev.description
                  );
                  if (googleId) {
                    await db
                      .from("events")
                      .update({ gcal_event_id: googleId })
                      .eq("id", inserted.id);
                  }
                } catch {}
                scheduled.push(
                  `${eventType} "${eventTitle}" on ${new Date(eventStart).toLocaleDateString()}`
                );
              }
            }

            const keyDatesText =
              rawKeyDates.length > 0
                ? ` Notable dates: ${rawKeyDates.map((k) => `${k.label} (${k.date})`).join("; ")}.`
                : "";
            if (scheduled.length > 0) {
              try {
                await db.from("agent_actions").insert({
                  title:
                    scheduled.length === 1
                      ? "Autoscheduled deadline"
                      : `Autoscheduled ${scheduled.length} deadlines`,
                  description: `Detected and scheduled ${scheduled.join("; ")} from an announcement on Supabase & Google Calendar.${keyDatesText}`,
                  action_type: "calendar",
                  source_id: ann.id,
                });
              } catch {}
            }

            let savedResource = false;
            for (const res of rawResources) {
              if (!res || typeof res.url !== "string" || !res.url) continue;
              const { data: existingRes } = await db
                .from("resources")
                .select("id")
                .eq("url", res.url)
                .maybeSingle();
              if (existingRes) continue;
              const { error: resError } = await db.from("resources").insert({
                title: res.title,
                url: res.url,
                description: res.description,
                source_platform: ann.platform_id,
                is_pinned: true,
              });
              if (!resError) savedResource = true;
            }
            if (savedResource) {
              try {
                await db.from("agent_actions").insert({
                  title: "Autosaved resource links",
                  description: `Extracted study reference link(s) from an announcement and saved them to Resources.`,
                  action_type: "resource",
                  source_id: ann.id,
                });
              } catch {}
            }

            if (scheduled.length === 0 && !savedResource) {
              try {
                await db.from("agent_actions").insert({
                  title: "Concierge Announcement Scan",
                  description:
                    warnings.length > 0
                      ? `Reviewed announcement but ${warnings.join("; ")}.`
                      : `Processed announcement "${ann.content.slice(0, 50)}...". Nothing new to schedule or save.`,
                  action_type: "sync",
                  source_id: ann.id,
                });
              } catch {}
            }
          } catch {
            aiErrors++;
            continue;
          }
        }
      }

      const { data: untitled } = await db
        .from("announcements")
        .select("id, title, content, ai_summary");
      for (const ann of (untitled ?? []) as Array<{
        id: string;
        title: string | null;
        content: string;
        ai_summary: string | null;
      }>) {
        const needsTitle = !ann.title || ann.title === deriveTitle(ann.content);
        const needsSummary = !ann.ai_summary;
        if (!needsTitle && !needsSummary) continue;
        try {
          const { text } = await generateText({
            model: googleProvider("gemini-flash-latest"),
            prompt: `For this announcement, respond with ONLY a JSON object (no markdown):
  {
  "title": "concise headline (max ~8 words), plain text, no markdown/quotes/emoji",
  "summary": "short easy-to-read summary (2-4 sentences) of the key points, plain language, no markdown"
  }
  Announcement:
  "${ann.content}"`,
          });
          const clean = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
          const parsed = JSON.parse(clean);
          const patch: Record<string, unknown> = {};
          const aiTitle = sanitizeTitle(parsed.title);
          const aiSummary = sanitizeSummary(parsed.summary);
          if (needsTitle && aiTitle) patch.title = aiTitle;
          if (needsSummary && aiSummary) patch.ai_summary = aiSummary;
          if (Object.keys(patch).length > 0) {
            await db.from("announcements").update(patch).eq("id", ann.id);
          }
        } catch {}
      }
    }
  } catch {}
  return aiErrors;
}
