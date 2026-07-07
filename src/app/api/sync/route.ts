import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { fetchChannelMessages } from "@/lib/platforms/discord";
import { fetchSlackMessages } from "@/lib/platforms/slack";
import { listAnnouncements, listAssignments } from "../../../../mcp/classroom/tools";
import { createGoogle } from "@ai-sdk/google";
import { generateText } from "ai";
import {
  writeToGoogleCalendar,
  listGoogleCalendarEvents,
  getGooglePlatformId,
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
function deriveTitle(text: string): string | null {
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 60) : null;
}

// Insert-only dedup: existing (platform_id, external_id) rows are left untouched.
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
  const { error } = await db.from("announcements").upsert(rows, {
    onConflict: "platform_id,external_id",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);
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

  // Google → local. Update existing (preserve event_type), insert new as "other".
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
      await db.from("events").insert({
        title: ev.summary,
        description: ev.description,
        event_type: "other",
        start_time: ev.startTime,
        end_time: ev.endTime,
        source_platform: platformId,
        source_external_id: gcalExternalId(ev.id),
        is_auto_detected: true,
      });
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
      content: a.text,
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
      content: m.content,
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
  ).flat();

  const annCount = await upsertAnnouncements(
    db,
    messages.map((m) => ({
      platform_id: platform.id,
      external_id: m.id,
      title: deriveTitle(m.content),
      content: m.content,
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
      } else {
        counts = await syncClassroom(db, platform);
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

  // ==========================================
  // AUTONOMOUS CONCIERGE AGENT PROCESSING LAYER
  // ==========================================
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

      // Fetch the last 5 announcements
      const { data: anns } = await db
        .from("announcements")
        .select("id, content, announced_at, platform_id")
        .order("announced_at", { ascending: false })
        .limit(5);

      if (anns && anns.length > 0) {
        for (const ann of anns) {
          const { data: existingAction } = await db
            .from("agent_actions")
            .select("id")
            .eq("source_id", ann.id)
            .maybeSingle();

          if (existingAction) continue;

          const prompt = `You are the autonomous Nexus AI Concierge Agent. Read this university announcement and determine if there is an upcoming quiz/midterm/assignment deadline that should be scheduled on the student's calendar, or an academic study link (like a Google Drive, PDF, slides, or syllabus reference URL) that should be saved to their Resources repository.

Announcement content:
"${ann.content}"

Rules:
- Respond ONLY with a valid JSON object matching the following TypeScript type:
{
  hasEvent: boolean;
  event?: {
    title: string;
    description: string;
    event_type: "exam" | "quiz" | "assignment" | "other";
    start_time: string; // ISO 8601 string, assume year is 2026 if not specified
  };
  hasResource: boolean;
  resource?: {
    title: string;
    url: string;
    description: string;
  };
}
- Do not add markdown backticks or any wrapper, return raw JSON string.`;

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

            if (result.hasEvent && result.event) {
              const eventRow = {
                title: result.event.title,
                description: result.event.description,
                event_type: result.event.event_type,
                start_time: result.event.start_time,
                source_platform: ann.platform_id,
                source_external_id: `auto-${ann.id}`,
                is_auto_detected: true,
              };

              const { error: evError } = await db
                .from("events")
                .upsert(eventRow, { onConflict: "source_platform,source_external_id" });

              if (!evError) {
                try {
                  const googleId = await writeToGoogleCalendar(
                    result.event.title,
                    result.event.start_time,
                    undefined,
                    result.event.description
                  );
                  // Store the gcal mapping on the just-upserted row so the import
                  // reconcile matches it instead of re-importing it as a dupe.
                  if (googleId) {
                    const gPlatformId = await getGooglePlatformId();
                    await db
                      .from("events")
                      .update({
                        source_platform: gPlatformId,
                        source_external_id: gcalExternalId(googleId),
                      })
                      .eq("source_platform", ann.platform_id)
                      .eq("source_external_id", `auto-${ann.id}`);
                  }
                } catch {}

                await db.from("agent_actions").insert({
                  title: `Autoscheduled ${result.event.event_type}`,
                  description: `Detected upcoming ${result.event.event_type} "${result.event.title}" on ${new Date(result.event.start_time).toLocaleDateString()} in announcements and scheduled it on Supabase & Google Calendar.`,
                  action_type: "calendar",
                  source_id: ann.id,
                });
              }
            }

            if (result.hasResource && result.resource) {
              const resRow = {
                title: result.resource.title,
                url: result.resource.url,
                description: result.resource.description,
                source_platform: ann.platform_id,
                is_pinned: true,
              };

              const { data: existingRes } = await db
                .from("resources")
                .select("id")
                .eq("url", result.resource.url)
                .maybeSingle();

              if (!existingRes) {
                const { error: resError } = await db.from("resources").insert(resRow);
                if (!resError) {
                  await db.from("agent_actions").insert({
                    title: "Autosaved Resource Link",
                    description: `Extracted study reference link "${result.resource.title}" from announcement and saved it to Resources.`,
                    action_type: "resource",
                    source_id: ann.id,
                  });
                }
              }
            }

            if (!result.hasEvent && !result.hasResource) {
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
    }
  } catch {}

  return Response.json({ synced });
}
