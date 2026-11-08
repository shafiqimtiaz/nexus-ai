import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { writeToGoogleCalendar } from "@/lib/auth/google-oauth";
import { normalizeEventTitle } from "@/lib/events/helpers";

export async function deduplicateEvents(
  db: ReturnType<typeof createServerClient>
): Promise<number> {
  const { data: rows } = await db
    .from("events")
    .select("id, title, event_type, start_time, description, source_external_id, gcal_event_id")
    .neq("status", "cancelled");

  type DedupRow = {
    id: string;
    title: string;
    event_type: string;
    start_time: string | null;
    description: string | null;
    source_external_id: string | null;
    gcal_event_id: string | null;
  };
  const groups = new Map<string, DedupRow[]>();
  for (const r of (rows ?? []) as DedupRow[]) {
    const dateKey = r.start_time ? r.start_time.slice(0, 10) : "";
    const key = `${normalizeEventTitle(r.title)}|${dateKey}|${r.event_type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  let removed = 0;
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    group.sort((a, b) => {
      const aScore =
        (a.source_external_id ? 2 : 0) + (a.description ? 1 : 0) + (a.gcal_event_id ? 1 : 0);
      const bScore =
        (b.source_external_id ? 2 : 0) + (b.description ? 1 : 0) + (b.gcal_event_id ? 1 : 0);
      return bScore - aScore;
    });
    // group[0] is the best-scored row and is kept.
    for (let i = 1; i < group.length; i++) {
      await db.from("events").update({ status: "cancelled" }).eq("id", group[i].id);
      removed++;
    }
  }
  return removed;
}

// Export-only mirror: push user-created events (no platform identity, no gcal
// mapping yet) to Google Calendar. Nexus is the source of truth; nothing is
// imported back and nothing local is ever deleted because of Google.
export async function pushLocalEventsToGoogle(
  db: ReturnType<typeof createServerClient>
): Promise<number> {
  let pushed = 0;
  const { data: rows } = await db
    .from("events")
    .select("id, title, start_time, end_time, description, source_external_id, gcal_event_id")
    .neq("status", "cancelled");
  for (const r of rows ?? []) {
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
