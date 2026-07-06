import "server-only";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { createServerClient } from "@/lib/supabase/server";

export type EventType =
  | "exam"
  | "quiz"
  | "assignment"
  | "study_block"
  | "other";

export type DashboardEvent = {
  id: string;
  title: string;
  event_type: EventType;
  start_time: string;
  end_time: string | null;
};

export type DashboardAnnouncement = {
  id: string;
  title: string | null;
  content: string;
  author: string | null;
  source_url: string | null;
  announced_at: string | null;
};

export type DashboardResource = {
  id: string;
  title: string;
  url: string;
  description: string | null;
};

export type DashboardData = {
  upcomingEvents: DashboardEvent[];
  todaysSchedule: DashboardEvent[];
  stats: {
    daysToNextExam: number | null;
    unreadAnnouncements: number;
    upcomingAssignments: number;
  };
  recentAnnouncements: DashboardAnnouncement[];
  pinnedResources: DashboardResource[];
};

const SNIPPET_LEN = 200;

function truncate(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > SNIPPET_LEN
    ? `${trimmed.slice(0, SNIPPET_LEN).trimEnd()}…`
    : trimmed;
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
    assignmentsRes,
    announcementsRes,
    resourcesRes,
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
      .select("start_time")
      .eq("event_type", "exam")
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false),
    db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "assignment")
      .gte("start_time", nowIso),
    db
      .from("announcements")
      .select("id, title, content, author, source_url, announced_at")
      .order("announced_at", { ascending: false, nullsFirst: false })
      .limit(5),
    db
      .from("resources")
      .select("id, title, url, description")
      .eq("is_pinned", true)
      .limit(6),
  ]);

  const daysToNextExam = nextExamRes.data?.start_time
    ? Math.max(
        0,
        differenceInCalendarDays(new Date(nextExamRes.data.start_time), now)
      )
    : null;

  return {
    upcomingEvents: (upcomingRes.data ?? []) as DashboardEvent[],
    todaysSchedule: (todayRes.data ?? []) as DashboardEvent[],
    stats: {
      daysToNextExam,
      unreadAnnouncements: unreadRes.count ?? 0,
      upcomingAssignments: assignmentsRes.count ?? 0,
    },
    recentAnnouncements: (announcementsRes.data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      content: truncate(a.content ?? ""),
      author: a.author,
      source_url: a.source_url,
      announced_at: a.announced_at,
    })),
    pinnedResources: (resourcesRes.data ?? []) as DashboardResource[],
  };
}
