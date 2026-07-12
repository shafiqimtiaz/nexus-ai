import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { fetchChannelMessages } from "@/lib/platforms/discord";
import { fetchSlackMessages } from "@/lib/platforms/slack";
import { isJoinLeaveMessage } from "@/lib/utils";
import { listAnnouncements, listAssignments } from "../../../../mcp/classroom/tools";
import { createGoogle } from "@ai-sdk/google";
import { generateText } from "ai";
import { writeToGoogleCalendar } from "@/lib/auth/google-oauth";

const STALE_MS = 15 * 60 * 1000;

type SyncResult = {
  type: string;
  announcements: number;
  events: number;
  skipped?: boolean;
  error?: string;
  authExpired?: boolean;
};

function isAuthFailure(type: string, message: string): boolean {
  if (type === "discord") return /\((401|403)\)/.test(message);
  if (type === "slack")
    return /(invalid_auth|not_authed|account_inactive|token_revoked|token_expired)/.test(message);
  return false;
}

interface PlatformRow {
  id: string;
  type: "google_classroom" | "discord" | "slack";
  external_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  last_synced_at: string | null;
}

function parseChannelIds(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

function deriveTitle(text: string): string | null {
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 60) : null;
}

function sanitizeTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/<[^>]*>/g, "")
    .replace(/[*_`#>~]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^["'"''\s]+|["'"''\s]+$/g, "")
    .trim();
  return cleaned ? cleaned.slice(0, 80) : null;
}

function sanitizeSummary(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/<[^>]*>/g, "")
    .replace(/[*_#>`~]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^["'"''\s]+|["'"''\s]+$/g, "")
    .trim();
  return cleaned ? cleaned.slice(0, 500) : null;
}

function normalizeEventTitle(title: string | null): string {
  if (!title) return "";
  return title
    .replace(/[:–—].*$/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function classifyEventType(title: string | null): "exam" | "quiz" | "assignment" | "other" {
  const t = (title ?? "").toLowerCase();
  if (/\b(exam|midterm|final)\b/.test(t)) return "exam";
  if (/\bquiz\b/.test(t)) return "quiz";
  if (/\b(assignment|homework|project)\b/.test(t)) return "assignment";
  return "other";
}

function sanitizeContent(raw: string): string {
  return raw.replace(/<@[!&]?\d+>/g, "").trim();
}

function isFutureDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

async function upsertAnnouncements(
  db: ReturnType<typeof createServerClient>,
  rows: Array<{
    platform_id: string;
    external_id: string;
    title: string | null;
    content: string;
    author?: string | null;
    source_url: string;
    announced_at: string | null;
  }>
): Promise<number> {
  if (rows.length === 0) return 0;

  const platformId = rows[0].platform_id;
  const { data: existingRows } = await db
    .from("announcements")
    .select("id, external_id, title, ai_summary")
    .eq("platform_id", platformId);
  const existingByExternal = new Map<
    string,
    { id: string; title: string | null; ai_summary: string | null }
  >((existingRows ?? []).map((r: any) => [r.external_id, r]));

  const toInsert: any[] = [];
  const toUpdate: any[] = [];
  for (const row of rows) {
    const existing = existingByExternal.get(row.external_id);
    if (!existing) {
      toInsert.push(row);
    } else {
      toUpdate.push({
        id: existing.id,
        content: row.content,
        author: row.author ?? null,
        source_url: row.source_url,
        announced_at: row.announced_at,
        title: existing.title ?? row.title,
        ai_summary: existing.ai_summary,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await db.from("announcements").insert(toInsert);
    if (error) throw new Error(error.message);
  }
  for (const row of toUpdate) {
    const { error } = await db.from("announcements").update(row).eq("id", row.id);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

// Export-only mirror: push user-created events (no platform identity, no gcal
// mapping yet) to Google Calendar. Nexus is the source of truth; nothing is
// imported back and nothing local is ever deleted because of Google.
async function pushLocalEventsToGoogle(db: ReturnType<typeof createServerClient>): Promise<number> {
  let pushed = 0;
  const { data: rows } = await db
    .from("events")
    .select("id, title, start_time, end_time, description, source_external_id, gcal_event_id")
    .neq("status", "cancelled");
  for (const r of (rows ?? []) as any[]) {
    if (r.source_external_id || r.gcal_event_id || !r.start_time) continue;
    const googleId = await writeToGoogleCalendar(
      r.title,
      r.start_time,
      r.end_time ?? undefined,
      r.description ?? undefined
    );
    if (googleId) {
      await db.from("events").update({ gcal_event_id: googleId }).eq("id", r.id);
      pushed++;
    }
  }
  return pushed;
}

async function syncClassroom(
  db: ReturnType<typeof createServerClient>,
  platform: PlatformRow
): Promise<{ announcements: number; events: number }> {
  const calendarEvents = await pushLocalEventsToGoogle(db);

  if (platform.external_id === "google_user") {
    return { announcements: 0, events: calendarEvents };
  }
  const announcements = await listAnnouncements();
  const annCount = await upsertAnnouncements(
    db,
    announcements.map((a) => ({
      platform_id: platform.id,
      external_id: a.id,
      title: deriveTitle(a.text),
      content: sanitizeContent(a.text),
      author: a.author ?? null,
      source_url: a.url,
      announced_at: a.createdAt || null,
    }))
  );

  const assignments = await listAssignments();
  const eventRows = assignments
    .filter((w) => w.dueDate)
    .map((w) => ({
      title: w.title,
      description: w.description,
      event_type: "assignment" as const,
      start_time: w.dueDate as string,
      source_platform: platform.id,
      source_external_id: w.id,
      is_auto_detected: true,
    }));

  let eventCount = 0;
  if (eventRows.length > 0) {
    const { error } = await db
      .from("events")
      .upsert(eventRows, { onConflict: "source_platform,source_external_id" });
    if (error) throw new Error(error.message);
    eventCount = eventRows.length;
  }

  return { announcements: annCount, events: eventCount + calendarEvents };
}

async function syncDiscord(
  db: ReturnType<typeof createServerClient>,
  platform: PlatformRow
): Promise<{ announcements: number; events: number }> {
  const channelIds = parseChannelIds(platform.external_id);
  if (!platform.access_token || !channelIds.length) {
    throw new Error("Discord platform is missing its user token or channel ID.");
  }

  const messages = (
    await Promise.all(
      channelIds.map((channelId) => fetchChannelMessages(platform.access_token!, channelId))
    )
  ).flat();

  const annCount = await upsertAnnouncements(
    db,
    messages.map((m) => ({
      platform_id: platform.id,
      external_id: m.id,
      title: deriveTitle(m.content),
      content: sanitizeContent(m.content),
      author: m.author || null,
      source_url: m.url,
      announced_at: m.timestamp || null,
    }))
  );

  return { announcements: annCount, events: 0 };
}

async function syncSlack(
  db: ReturnType<typeof createServerClient>,
  platform: PlatformRow
): Promise<{ announcements: number; events: number }> {
  const channelIds = parseChannelIds(platform.external_id);
  if (!platform.access_token || !platform.refresh_token || !channelIds.length) {
    throw new Error("Slack platform is missing its token, d cookie, or channel ID.");
  }

  const messages = (
    await Promise.all(
      channelIds.map((channelId) =>
        fetchSlackMessages(platform.access_token!, platform.refresh_token!, channelId)
      )
    )
  )
    .flat()
    .filter((m) => !isJoinLeaveMessage(m.content));

  const annCount = await upsertAnnouncements(
    db,
    messages.map((m) => ({
      platform_id: platform.id,
      external_id: m.id,
      title: deriveTitle(m.content),
      content: sanitizeContent(m.content),
      author: m.author || null,
      source_url: m.url,
      announced_at: m.timestamp || null,
    }))
  );

  return { announcements: annCount, events: 0 };
}

export async function POST(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";
  const db = createServerClient();

  const { data, error } = await db
    .from("platforms")
    .select("id, type, external_id, access_token, refresh_token, last_synced_at")
    .eq("is_connected", true);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const platforms = (data ?? []) as PlatformRow[];
  const synced: SyncResult[] = [];
  const staleCutoff = Date.now() - STALE_MS;

  for (const platform of platforms) {
    if (!force && platform.last_synced_at) {
      const lastMs = new Date(platform.last_synced_at).getTime();
      if (!Number.isNaN(lastMs) && lastMs > staleCutoff) {
        synced.push({
          type: platform.type,
          announcements: 0,
          events: 0,
          skipped: true,
        });
        continue;
      }
    }

    try {
      let counts = { announcements: 0, events: 0 };
      if (platform.type === "discord") {
        counts = await syncDiscord(db, platform);
      } else if (platform.type === "slack") {
        counts = await syncSlack(db, platform);
      } else if (platform.type === "google_classroom") {
        counts = await syncClassroom(db, platform);
      } else {
        continue;
      }

      await db
        .from("platforms")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", platform.id);

      synced.push({ type: platform.type, ...counts });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      const authExpired = isAuthFailure(platform.type, message);
      if (authExpired) {
        await db.from("platforms").update({ is_connected: false }).eq("id", platform.id);
      }
      synced.push({
        type: platform.type,
        announcements: 0,
        events: 0,
        error: message,
        authExpired,
      });
    }
  }

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

          const prompt = `You are the autonomous Nexus AI Concierge Agent. Read this university announcement in FULL and extract EVERYTHING useful for a student's academic organizer.

Announcement content:
"${ann.content}"

Extract ALL of the following — be exhaustive, never stop after the first match:
- summary: A short, easy-to-read summary (2–4 sentences, plain language, no markdown) of the announcement's key points so a student can skim it at a glance. Lead with what matters most. Preserve concrete details (rooms, times, dates, names).
- title: A concise, human-readable headline for the whole announcement (max ~8 words), plain text only — no markdown, quotes, or emoji.
- events: EVERY deadline or scheduled occurrence — every quiz, exam, midterm, final, assignment/homework/project submission, office hour, review session, or meeting. Assignment submission deadlines MUST use event_type "assignment"; quizzes "quiz"; exams/midterms/finals "exam"; other scheduled items "other". If a date/time range is given, set end_time too.
- resources: EVERY distinct URL (Google Docs, Drive, Forms, PDFs, slides, syllabus, repo, video, website) as a resource. Use the link's visible label as the title when present; otherwise infer a short title from context. Add a one-line description of what the link is.
- key_dates: An array of {label, date} for ANY standalone important dates mentioned even if they don't become calendar events (e.g. "Reading due", "Drop deadline"). Use ISO 8601 dates. Empty array if none.

Rules:
- A single announcement often bundles MULTIPLE items (e.g. a quiz AND an assignment, plus several links). Capture EVERY one as its own array entry.
- Respond ONLY with a valid JSON object matching this TypeScript type:
{
  summary: string;
  title: string;
  events: Array<{
    title: string;
    description: string;
    event_type: "exam" | "quiz" | "assignment" | "other";
    start_time: string; // ISO 8601. Use the stated due date/time; assume year 2026 if not specified, and 23:59 local time if only a date is given.
    end_time: string;   // ISO 8601 or empty string when not stated.
  }>;
  resources: Array<{
    title: string;
    url: string;
    description: string;
  }>;
  key_dates: Array<{ label: string; date: string }>;
}
- Use empty arrays when there are no events, resources, or key_dates.
- Do not add markdown backticks or any wrapper — return raw JSON string.`;

          const { text } = await generateText({
            model: googleProvider("gemini-flash-lite-latest"),
            prompt,
          });

          const cleanText = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
          try {
            const result = JSON.parse(cleanText);

            const aiTitle = sanitizeTitle(result.title);
            const aiSummary = sanitizeSummary(result.summary);
            const patch: Record<string, unknown> = {};
            if (aiTitle) patch.title = aiTitle;
            if (aiSummary) patch.ai_summary = aiSummary;
            if (Object.keys(patch).length > 0) {
              await db.from("announcements").update(patch).eq("id", ann.id);
            }

            const rawEvents: any[] = Array.isArray(result.events)
              ? result.events
              : result.event
                ? [result.event]
                : [];
            const rawResources: any[] = Array.isArray(result.resources)
              ? result.resources
              : result.resource
                ? [result.resource]
                : [];
            const rawKeyDates: any[] = Array.isArray(result.key_dates) ? result.key_dates : [];

            const events = rawEvents
              .filter((e) => {
                if (!e || typeof e.start_time !== "string") return false;
                if (e.event_type === "assignment") return true;
                return isFutureDate(e.start_time);
              })
              .map((e) => {
                const endRaw = typeof e.end_time === "string" ? e.end_time.trim() : "";
                const endMs = endRaw ? new Date(endRaw).getTime() : NaN;
                const startMs = new Date(e.start_time).getTime();
                const end_time = !Number.isNaN(endMs) && endMs > startMs ? endRaw : null;
                return { ...e, end_time };
              });

            const EVENT_COLS_FULL = "id, source_platform, source_external_id, title";
            const scheduled: string[] = [];

            for (let i = 0; i < events.length; i++) {
              const ev = events[i];
              const eventTitle = ev.title;
              const eventStart = ev.start_time;
              const eventType =
                ev.event_type && ev.event_type !== "other"
                  ? ev.event_type
                  : classifyEventType(eventTitle);
              const autoExternalId = `auto-${ann.id}-${i}`;

              const { data: existingByAuto } = await db
                .from("events")
                .select(EVENT_COLS_FULL)
                .eq("source_platform", ann.platform_id)
                .eq("source_external_id", autoExternalId)
                .maybeSingle();

              const { data: contentCandidates } = existingByAuto
                ? { data: [] }
                : await db
                    .from("events")
                    .select(EVENT_COLS_FULL)
                    .eq("start_time", eventStart)
                    .eq("event_type", eventType);
              const existingByContent = (contentCandidates ?? []).find(
                (c: any) => normalizeEventTitle(c.title) === normalizeEventTitle(eventTitle)
              );

              const existing = existingByAuto ?? existingByContent;

              let isNew = false;
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
                isNew = true;
              }

              if (isNew) {
                try {
                  await writeToGoogleCalendar(
                    eventTitle,
                    eventStart,
                    ev.end_time ?? undefined,
                    ev.description
                  );
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

            if (events.length === 0 && rawResources.length === 0 && rawKeyDates.length === 0) {
              await db.from("agent_actions").insert({
                title: "Concierge Announcement Scan",
                description: `Processed announcement "${ann.content.slice(0, 50)}...". No actionable events or study links detected.`,
                action_type: "sync",
                source_id: ann.id,
              });
            }
          } catch {}
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
            model: googleProvider("gemini-flash-lite-latest"),
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

  return Response.json({ synced });
}
