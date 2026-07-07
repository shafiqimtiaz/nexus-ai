import { getRole } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { TodaysSchedule } from "@/components/dashboard/todays-schedule";
import { RecentAnnouncements } from "@/components/dashboard/recent-announcements";
import { PinnedResources } from "@/components/dashboard/pinned-resources";
import { AgentActions } from "@/components/dashboard/agent-actions";
import { SyncOnLoad } from "@/components/dashboard/sync-on-load";

// Reads from the DB at request time, so keep it out of the build-time prerender.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — Nexus",
};

export default async function DashboardPage() {
  const [role, data] = await Promise.all([getRole(), getDashboardData()]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your exams, schedule, and updates at a glance.
          </p>
        </div>
        <SyncOnLoad role={role} />
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-6">
          <QuickStats stats={data.stats} />

          <div className="grid gap-6 lg:grid-cols-3">
            <UpcomingEvents events={data.upcomingEvents} className="lg:col-span-2" />
            <TodaysSchedule events={data.todaysSchedule} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <RecentAnnouncements items={data.recentAnnouncements} className="lg:col-span-2" />
            <AgentActions items={data.agentActions} />
          </div>
        </div>

        {/* Right sidebar — pinned resources */}
        <aside className="flex w-full shrink-0 flex-col lg:w-64 xl:w-72">
          <div className="flex-1 lg:sticky lg:top-6">
            <PinnedResources resources={data.pinnedResources} />
          </div>
        </aside>
      </div>
    </div>
  );
}
