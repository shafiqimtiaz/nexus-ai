import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { fetchChannelMessages } from "@/lib/platforms/discord";
import { fetchSlackMessages } from "@/lib/platforms/slack";
import { listAnnouncements, listAssignments } from "../../../../mcp/classroom/tools";
import { createGoogle } from "@ai-sdk/google";
import { generateText } from "ai";
import { writeToGoogleCalendar } from "@/lib/auth/google-oauth";

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
};

interface PlatformRow {
  id: string;
  type: "google_classroom" | "discord" | "slack";
  external_id: string | null;
  access_token: string | null;
  last_synced_at: string | null;
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

async function syncClassroom(
  db: ReturnType<typeof createServerClient>,
  platform: PlatformRow
): Promise<{ announcements: number; events: number }> {
  if (platform.external_id === "google_user") {
    return { announcements: 0, events: 0 };
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

  return { announcements: annCount, events: eventCount };
}

async function syncDiscord(
  db: ReturnType<typeof createServerClient>,
  platform: PlatformRow
): Promise<{ announcements: number; events: number }> {
  if (!platform.access_token || !platform.external_id) {
    throw new Error("Discord platform is missing its bot token or channel ID.");
  }

  const messages = await fetchChannelMessages(platform.access_token, platform.external_id);

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
  if (!platform.access_token || !platform.external_id) {
    throw new Error("Slack platform is missing its bot token or channel ID.");
  }

  const messages = await fetchSlackMessages(platform.access_token, platform.external_id);

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
    .select("id, type, external_id, access_token, last_synced_at")
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
      synced.push({
        type: platform.type,
        announcements: 0,
        events: 0,
        error: err instanceof Error ? err.message : "Sync failed",
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
                  await writeToGoogleCalendar(
                    result.event.title,
                    result.event.start_time,
                    undefined,
                    result.event.description
                  );
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
