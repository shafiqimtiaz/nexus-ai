import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { fetchChannelMessages } from "@/lib/platforms/discord";
import { fetchSlackMessages } from "@/lib/platforms/slack";
import { isJoinLeaveMessage } from "@/lib/utils";
import { listAnnouncements, listAssignments } from "../../../mcp/classroom/tools";
import {
  type PlatformRow,
  deriveTitle,
  parseChannelIds,
  sanitizeContent,
  upsertAnnouncements,
} from "./shared";
import { pushLocalEventsToGoogle } from "./maintenance";

export async function syncClassroom(
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

const ANNOUNCEMENT_MIN_LENGTH = 25;

function isAnnouncementWorthy(content: string): boolean {
  const c = content.trim();
  if (c.length < ANNOUNCEMENT_MIN_LENGTH) return false;
  if (/^<@!?&?\d+>$/i.test(c)) return false;
  const lower = c.toLowerCase();
  if (/^(sir|ma'?a?m|madam)\b/i.test(lower)) return false;
  if (c.endsWith("?") && c.length < 50) return false;
  if (
    /\b(sir|ma'?a?m|madam)\b/i.test(lower) &&
    /\b(please|postpone)\b/i.test(lower) &&
    c.length < 100
  )
    return false;
  return true;
}

export async function syncDiscord(
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

  const filteredMessages = messages.filter((m) => isAnnouncementWorthy(m.content));

  const annCount = await upsertAnnouncements(
    db,
    filteredMessages.map((m) => ({
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

export async function syncSlack(
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
    .filter((m) => !isJoinLeaveMessage(m.content))
    .filter((m) => isAnnouncementWorthy(m.content));

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
