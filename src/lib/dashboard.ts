import "server-only";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { createServerClient } from "@/lib/supabase/server";

export type EventType = "exam" | "quiz" | "assignment" | "study_block" | "other";

export type DashboardEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_time: string;
  end_time: string | null;
  source_platform: string | null;
  // Resolved platform type (e.g. "google_classroom", "discord") for display,
  // derived from source_platform → platforms.type. Null when the event was
  // created locally / has no connected platform.
  platform?: string | null;
};

export type DashboardAnnouncement = {
  id: string;
  title: string | null;
  content: string;
  ai_summary: string | null;
  author: string | null;
  source_url: string | null;
  announced_at: string | null;
  channel: string | null;
  platform: string | null;
};

export type DashboardResource = {
  id: string;
  title: string;
  url: string;
  description: string | null;
};

export type DashboardAgentAction = {
  id: string;
  title: string;
  description: string;
  action_type: "calendar" | "resource" | "sync" | "chat";
  created_at: string;
};

export type DashboardData = {
  upcomingEvents: DashboardEvent[];
  todaysSchedule: DashboardEvent[];
  stats: {
    daysToNextExam: number | null;
    unreadAnnouncements: number;
    upcomingAssignments: number;
  };
  upcomingAssignmentEvents: DashboardEvent[];
  recentAnnouncements: DashboardAnnouncement[];
  pinnedResources: DashboardResource[];
  agentActions: DashboardAgentAction[];
};

const SNIPPET_LEN = 200;

function truncate(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > SNIPPET_LEN ? `${trimmed.slice(0, SNIPPET_LEN).trimEnd()}…` : trimmed;
}

// Single aggregated read used by both the dashboard page (server component) and
// GET /api/dashboard, so neither pays for an HTTP self-fetch. Read-only, so demo
// users get the seeded data exactly like the owner.
export async function getDashboardData(): Promise<DashboardData> {
  const db = createServerClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const startToday = startOfDay(now).toISOString();
  const startTomorrow = addDays(startOfDay(now), 1).toISOString();
  const in7Days = addDays(now, 7).toISOString();

  const [
    upcomingRes,
    todayRes,
    nextExamRes,
    unreadRes,
    assignmentsCountRes,
    assignmentEventsRes,
    announcementsRes,
    resourcesRes,
    agentActionsRes,
    platformsRes,
  ] = await Promise.all([
    db
      .from("events")
      .select("id, title, event_type, start_time, end_time")
      .gte("start_time", nowIso)
      .lte("start_time", in7Days)
      .in("event_type", ["exam", "quiz"])
      .order("start_time", { ascending: true })
      .limit(10),
    db
      .from("events")
      .select("id, title, event_type, start_time, end_time")
      .gte("start_time", startToday)
      .lt("start_time", startTomorrow)
      .order("start_time", { ascending: true }),
    db
      .from("events")
      .select("id, title, event_type, start_time, end_time")
      .eq("event_type", "exam")
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db.from("announcements").select("id", { count: "exact", head: true }).eq("is_read", false),
    db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "assignment"),
    db
      .from("events")
      .select("id, title, description, event_type, start_time, end_time, source_platform")
      .eq("event_type", "assignment")
      .order("start_time", { ascending: true })
      .limit(20),
    db
      .from("announcements")
      .select("id, title, content, ai_summary, author, source_url, announced_at, platform_id")
      .order("announced_at", { ascending: false, nullsFirst: false })
      .limit(30),
    db.from("resources").select("id, title, url, description").eq("is_pinned", true).limit(6),
    db
      .from("agent_actions")
      .select("id, title, description, action_type, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    db.from("platforms").select("id, name, type"),
  ]);

  // Map platform_id → { channel name, platform type } so each announcement can
  // show which channel and platform it came from without a DB-level join
  // (the mock client doesn't support nested selects).
  const platformById = new Map<string, { name: string | null; type: string | null }>(
    (platformsRes.data ?? []).map((p: any) => [p.id, { name: p.name, type: p.type }])
  );

  const daysToNextExam = nextExamRes.data?.start_time
    ? Math.max(0, differenceInCalendarDays(new Date(nextExamRes.data.start_time), now))
    : null;

  // Merge the nearest future exam into the upcoming list even when it falls
  // outside the 7-day window, so the list stays consistent with the
  // "Days to next exam" stat (which counts any future exam). Dedupe by id in
  // case the exam is already within the window.
  const upcoming = (upcomingRes.data ?? []) as DashboardEvent[];
  const nextExam = (nextExamRes.data ?? null) as DashboardEvent | null;
  if (nextExam && !upcoming.some((e) => e.id === nextExam.id)) {
    upcoming.push(nextExam);
    upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }

  return {
    upcomingEvents: upcoming,
    todaysSchedule: (todayRes.data ?? []) as DashboardEvent[],
    stats: {
      daysToNextExam,
      unreadAnnouncements: unreadRes.count ?? 0,
      upcomingAssignments: assignmentsCountRes.count ?? 0,
    },
    upcomingAssignmentEvents: (assignmentEventsRes.data ?? []).map((e: any) => ({
      ...e,
      platform: e.source_platform ? (platformById.get(e.source_platform)?.type ?? null) : null,
    })) as DashboardEvent[],
    recentAnnouncements: (announcementsRes.data ?? []).map((a: any) => {
      const platform = platformById.get(a.platform_id);
      return {
        id: a.id,
        title: a.title,
        content: truncate(a.content ?? ""),
        ai_summary: a.ai_summary ?? null,
        author: a.author,
        source_url: a.source_url,
        announced_at: a.announced_at,
        channel: platform?.name ?? null,
        platform: platform?.type ?? null,
      };
    }),
    pinnedResources: (resourcesRes.data ?? []) as DashboardResource[],
    agentActions: (agentActionsRes.data ?? []) as DashboardAgentAction[],
  };
}
