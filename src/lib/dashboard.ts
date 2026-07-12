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
  platform?: string | null;
  is_auto_detected?: boolean;
  source_url?: string | null;
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
      .select(
        "id, title, description, event_type, start_time, end_time, source_platform, source_external_id, is_auto_detected"
      )
      .gte("start_time", nowIso)
      .lte("start_time", in7Days)
      .neq("status", "cancelled")
      .in("event_type", ["exam", "quiz"])
      .order("start_time", { ascending: true })
      .limit(10),
    db
      .from("events")
      .select("id, title, description, event_type, start_time, end_time, source_platform")
      .gte("start_time", startToday)
      .lt("start_time", startTomorrow)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true }),
    db
      .from("events")
      .select(
        "id, title, description, event_type, start_time, end_time, source_platform, source_external_id, is_auto_detected"
      )
      .eq("event_type", "exam")
      .gte("start_time", nowIso)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db.from("announcements").select("id", { count: "exact", head: true }).eq("is_read", false),
    db.from("events").select("id", { count: "exact", head: true }).eq("event_type", "assignment").neq("status", "cancelled"),
    db
      .from("events")
      .select("id, title, description, event_type, start_time, end_time, source_platform")
      .eq("event_type", "assignment")
      .neq("status", "cancelled")
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

  // mock client doesn't support nested selects
  const platformById = new Map<string, { name: string | null; type: string | null }>(
    (platformsRes.data ?? []).map((p: any) => [p.id, { name: p.name, type: p.type }])
  );

  const daysToNextExam = nextExamRes.data?.start_time
    ? Math.max(0, differenceInCalendarDays(new Date(nextExamRes.data.start_time), now))
    : null;

  const AUTO_ID_RE =
    /^auto-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const annIdOf = (sid: unknown): string | null => {
    const m = typeof sid === "string" ? sid.match(AUTO_ID_RE) : null;
    return m ? m[1] : null;
  };

  const rawUpcoming = [...(upcomingRes.data ?? [])];
  const nextExamRow = nextExamRes.data ?? null;
  if (nextExamRow && !rawUpcoming.some((e) => e.id === nextExamRow.id)) {
    rawUpcoming.push(nextExamRow);
    rawUpcoming.sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }

  const annIds = rawUpcoming
    .map((e) => annIdOf(e.source_external_id))
    .filter((x): x is string => x !== null);
  const annUrlById = new Map<string, string | null>();
  if (annIds.length > 0) {
    const { data: annRows } = await db
      .from("announcements")
      .select("id, source_url")
      .in("id", annIds);
    for (const a of annRows ?? []) annUrlById.set(a.id, a.source_url ?? null);
  }

  const upcoming: DashboardEvent[] = rawUpcoming.map((e) => {
    const { source_external_id, ...rest } = e;
    const annId = annIdOf(source_external_id);
    return {
      ...rest,
      platform: e.source_platform
        ? (platformById.get(e.source_platform)?.type ?? null)
        : null,
      source_url: annId ? (annUrlById.get(annId) ?? null) : null,
    };
  });

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
