import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { type SyncResult, type PlatformRow, isAuthFailure } from "@/lib/sync/shared";
import { syncClassroom, syncDiscord, syncSlack } from "@/lib/sync/platforms";
import { deduplicateEvents } from "@/lib/sync/maintenance";
import { runConcierge } from "@/lib/sync/concierge";

const STALE_MS = 15 * 60 * 1000;

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

  const aiErrors = await runConcierge(db);

  const deduped = await deduplicateEvents(db);

  return Response.json({ synced, aiErrors, deduped });
}
