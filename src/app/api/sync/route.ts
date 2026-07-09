import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { fetchChannelMessages } from "@/lib/platforms/discord";
import { fetchSlackMessages } from "@/lib/platforms/slack";
import { isJoinLeaveMessage } from "@/lib/utils";
import { listAnnouncements, listAssignments } from "../../../../mcp/classroom/tools";
import { createGoogle } from "@ai-sdk/google";
import { generateText } from "ai";
import {
  writeToGoogleCalendar,
  listGoogleCalendarEvents,
  gcalExternalId,
  parseGcalId,
} from "@/lib/auth/google-oauth";

// POST /api/sync — pull announcements/assignments from every connected platform
// into the local DB cache. Owner-only (it mutates the DB). Each platform is
// guarded by a 15-minute staleness gate (bypass with ?force=1) and processed in
// its own try/catch so one platform failing never aborts the others. Tokens are
// never returned or logged.

const STALE_MS = 15 * 60 * 1000;

type SyncResult = {
  type: string;
  announcements: number;
  events: number;
  skipped?: boolean;
  error?: string;
  authExpired?: boolean;
};

// A thrown fetcher error means the stored browser/user token was rejected.
// Discord surfaces the HTTP status in the message; Slack surfaces its error code.
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

// One token can back several channels; they're stored comma-separated in
// external_id.
function parseChannelIds(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

// First ~60 chars of the announcement text as a title, or null when empty.
// Used at ingestion; the concierge pass later replaces this with an AI title.
function deriveTitle(text: string): string | null {
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 60) : null;
}

// Sanitize an AI-generated title: strip markdown/HTML, unwrap quotes, collapse
// whitespace, and cap length. Returns null if nothing usable remains.
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

// Sanitize the AI-generated announcement summary: strip HTML/markdown, collapse
// whitespace, and cap length. Returns null if nothing usable remains.
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

// Google Calendar has no exam/quiz/assignment concept, so imported events would
// all default to "other" and never surface in the dashboard's typed widgets.
// Best-effort classify from the title keywords; fall back to "other".
function classifyEventType(title: string | null): "exam" | "quiz" | "assignment" | "other" {
  const t = (title ?? "").toLowerCase();
  if (/\b(exam|midterm|final)\b/.test(t)) return "exam";
  if (/\bquiz\b/.test(t)) return "quiz";
  if (/\b(assignment|homework|project)\b/.test(t)) return "assignment";
  return "other";
}

// Strip platform mentions only (Discord <@&...>, Slack <@U...>).
// Leave HTML, emails, code, etc. intact.
function sanitizeContent(raw: string): string {
  return raw.replace(/<@[!&]?\d+>/g, "").trim();
}

// The concierge only schedules *upcoming* events. Reject dates that are missing,
// unparseable, or already in the past so a past announcement (e.g. an old exam
// script viewing) can never be stored as a future event and silently vanish
// from the dashboard's `>= now` filters.
function isFutureDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

// Upsert announcements. New rows are inserted (with a derived title); existing
// rows have their mutable platform fields (content, author, source_url,
// announced_at) refreshed so edited/updated posts stay accurate — but the AI
// title and AI summary are preserved if the concierge already set them.
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

  // Discover which external_ids already exist for this platform so we can split
  // into inserts vs. in-place updates (Supabase upsert would clobber the
  // AI-set title/summary with the raw derived title).
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
      // Preserve AI-generated values; only refresh what the platform can change.
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

// Two-way calendar sync for the Google connection. Returns the number of
// events touched (imported/updated/pushed). Approach A: list a bounded window,
// upsert Google→local (Google wins on title/desc/times, local event_type kept),
// delete-detect within the window, then backfill unmapped local events up.
const IMPORT_WINDOW_PAST_MS = 30 * 24 * 60 * 60 * 1000;
const IMPORT_WINDOW_FUTURE_MS = 90 * 24 * 60 * 60 * 1000;

async function syncGoogleCalendar(
  db: ReturnType<typeof createServerClient>,
  platformId: string
): Promise<number> {
  const now = Date.now();
  const timeMin = new Date(now - IMPORT_WINDOW_PAST_MS).toISOString();
  const timeMax = new Date(now + IMPORT_WINDOW_FUTURE_MS).toISOString();
  const timeMinMs = now - IMPORT_WINDOW_PAST_MS;
  const timeMaxMs = now + IMPORT_WINDOW_FUTURE_MS;

  const googleEvents = await listGoogleCalendarEvents(timeMin, timeMax);
  const googleIds = new Set(googleEvents.map((e) => e.id));
  let touched = 0;

  // Existing calendar-synced rows for this platform (gcal: marker only, so
  // Classroom coursework rows are never reconciled or deleted here).
  const { data: platformRows } = await db
    .from("events")
    .select("id, source_external_id, event_type, start_time")
    .eq("source_platform", platformId);
  const localGcal = (platformRows ?? []).filter((r: any) => parseGcalId(r.source_external_id));
  const localByGid = new Map<string, any>(
    localGcal.map((r: any) => [parseGcalId(r.source_external_id) as string, r])
  );

  // Content-dedup guard. Google Calendar can itself hold several events with the
  // same title and time (legacy junk from the old concierge). Mirroring by id
  // would recreate every one of them locally. Collapse to a single row by
  // skipping the import of any Google event whose (title, start_time) already
  // exists locally. Keyed on lowercased title + start epoch (format-agnostic).
  const { data: contentRows } = await db.from("events").select("title, start_time");
  const contentKey = (title: string | null, start: string | null): string => {
    const ms = start ? new Date(start).getTime() : NaN;
    return `${(title ?? "").trim().toLowerCase()} ${ms}`;
  };
  const seenContent = new Set<string>(
    (contentRows ?? []).map((r: any) => contentKey(r.title, r.start_time))
  );

  // Google → local. Update existing by id (preserve event_type). Insert new
  // ones classified by title, unless the same title/time already exists.
  for (const ev of googleEvents) {
    if (!ev.startTime) continue;
    const existing = localByGid.get(ev.id);
    if (existing) {
      await db
        .from("events")
        .update({
          title: ev.summary,
          description: ev.description,
          start_time: ev.startTime,
          end_time: ev.endTime,
        })
        .eq("id", existing.id);
    } else {
      const key = contentKey(ev.summary, ev.startTime);
      if (seenContent.has(key)) continue; // redundant Google event — don't duplicate
      await db.from("events").insert({
        title: ev.summary,
        description: ev.description,
        event_type: classifyEventType(ev.summary),
        start_time: ev.startTime,
        end_time: ev.endTime,
        source_platform: platformId,
        source_external_id: gcalExternalId(ev.id),
        is_auto_detected: true,
      });
      seenContent.add(key);
    }
    touched++;
  }

  // Delete-detection: a local gcal row inside the window but absent from Google
  // was deleted on Google → remove locally. Rows outside the window are skipped
  // (we can't judge them from this fetch).
  for (const r of localGcal) {
    const startMs = r.start_time ? new Date(r.start_time).getTime() : NaN;
    if (Number.isNaN(startMs) || startMs < timeMinMs || startMs > timeMaxMs) continue;
    const gid = parseGcalId(r.source_external_id) as string;
    if (!googleIds.has(gid)) {
      await db.from("events").delete().eq("id", r.id);
      touched++;
    }
  }

  // Backfill: local events never pushed to Google (manual/AI events created
  // while disconnected) have no source_external_id → push them up and map them.
  const { data: allEvents } = await db
    .from("events")
    .select("id, title, start_time, end_time, description, source_external_id");
  for (const r of (allEvents ?? []) as any[]) {
    if (r.source_external_id || !r.start_time) continue;
    const googleId = await writeToGoogleCalendar(
      r.title,
      r.start_time,
      r.end_time ?? undefined,
      r.description ?? undefined
    );
    if (googleId) {
      await db
        .from("events")
        .update({ source_platform: platformId, source_external_id: gcalExternalId(googleId) })
        .eq("id", r.id);
      touched++;
    }
  }

  return touched;
}

async function syncClassroom(
  db: ReturnType<typeof createServerClient>,
  platform: PlatformRow
): Promise<{ announcements: number; events: number }> {
  // Calendar sync runs for any Google connection, even one without a Classroom
  // course (external_id === "google_user").
  const calendarEvents = await syncGoogleCalendar(db, platform.id);

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
  // Only due-dated assignments become calendar events.
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
    // ignoreDuplicates omitted (default false) so re-syncing updates due dates.
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
    // Staleness gate: skip platforms synced within the last 15 minutes.
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
        // gemini is an API-key holder, not a syncable source. Running the
        // classroom/calendar sync for it mirrored every Google event a second
        // time under the gemini platform id — the duplicate-event bug.
        continue;
      }

      await db
        .from("platforms")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", platform.id);

      synced.push({ type: platform.type, ...counts });
    } catch (err) {
      // One platform failing must not abort the rest. Never surface the token.
      const message = err instanceof Error ? err.message : "Sync failed";
      const authExpired = isAuthFailure(platform.type, message);
      // A rejected token won't fix itself — flip is_connected off so the UI shows
      // "Not connected", re-exposes the token inputs, and stops re-syncing a dead
      // token until the user reconnects.
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

            // A single announcement frequently bundles several actionable items
            // (e.g. a quiz AND an assignment deadline, plus several links).
            // Normalize to arrays, and still accept the legacy singular shape so
            // older cached model responses keep working.
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

            // Schedule well-formed events. Exams/quizzes/study blocks are only
            // useful when upcoming, but assignment deadlines are tracked as
            // academic workload and must be captured regardless of whether the
            // due date is in the past or future — so assignment-typed events
            // bypass the future-only gate (there is intentionally NO date cap).
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
                const end_time =
                  !Number.isNaN(endMs) && endMs > startMs ? endRaw : null;
                return { ...e, end_time };
              });

            const EVENT_COLS_FULL = "id, source_platform, source_external_id";
            const scheduled: string[] = [];

            for (let i = 0; i < events.length; i++) {
              const ev = events[i];
              const eventTitle = ev.title;
              const eventStart = ev.start_time;
              // Rescue misclassifications: if the AI shrugged with "other" but
              // the title clearly names a quiz/exam/assignment, keep the keyword.
              const eventType =
                ev.event_type && ev.event_type !== "other"
                  ? ev.event_type
                  : classifyEventType(eventTitle);
              // Index the auto-id so multiple events from the SAME announcement
              // don't collide on the (source_platform, source_external_id) key.
              const autoExternalId = `auto-${ann.id}-${i}`;

              // 1. Look for an event we already created for this slot (preferred),
              //    then fall back to a content match (title + start) so a re-sync
              //    or a legacy `auto-<id>` row is never duplicated.
              const { data: existingByAuto } = await db
                .from("events")
                .select(EVENT_COLS_FULL)
                .eq("source_platform", ann.platform_id)
                .eq("source_external_id", autoExternalId)
                .maybeSingle();

              const { data: existingByContent } = existingByAuto
                ? { data: null }
                : await db
                    .from("events")
                    .select(EVENT_COLS_FULL)
                    .eq("description", ev.description)
                    .eq("start_time", eventStart)
                    .eq("event_type", eventType)
                    .maybeSingle();

              const existing = existingByAuto ?? existingByContent;

              // 2. Upsert the event row. Authoritative de-duplication is the
              //    partial unique index events_auto_dedup_idx
              //    (description, start_time, event_type WHERE is_auto_detected);
              //    the (source_platform, source_external_id) key keeps
              //    per-announcement rows idempotent. The AI varies TITLES for the
              //    same event, so we match on content, not title. A concurrent
              //    sync that races past this check hits the unique index on
              //    insert — the error is swallowed below and the row is skipped,
              //    so duplicates can never persist.
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
                // A concurrent sync won the race for this slot — skip it, the
                // other call recorded it.
                if (evError || !inserted) continue;
                isNew = true;
              }

              // 3. Push to Google only for newly created rows. Existing rows were
              //    pushed on their first sync; re-pushing would duplicate them.
              if (isNew) {
                try {
                  await writeToGoogleCalendar(
                    eventTitle,
                    eventStart,
                    ev.end_time ?? undefined,
                    ev.description
                  );
                } catch {
                  // Calendar failures must not block the agent action log.
                }
                scheduled.push(
                  `${eventType} "${eventTitle}" on ${new Date(eventStart).toLocaleDateString()}`
                );
              }
            }

            // 4. Log ONE aggregated calendar action per announcement. The partial
            //    unique index on (user_id, source_id, action_type) permits only a
            //    single 'calendar' row per announcement anyway.
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
              } catch {
                // Duplicate — already logged.
              }
            }

            // Resources: save every distinct link, deduped globally by URL.
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
              } catch {
                // Duplicate — already logged.
              }
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

      // Title + summary backfill: give every existing announcement a clean AI
      // title and an easy-to-read summary. Idempotent — a row is only (re)titled
      // while its title is still the raw 60-char ingestion prefix (or null), and
      // only (re)summarized while ai_summary is still missing, so later syncs
      // skip it and burn no AI calls.
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
