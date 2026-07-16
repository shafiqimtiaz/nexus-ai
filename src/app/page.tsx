import { getRole } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PinnedResources } from "@/components/dashboard/pinned-resources";
import { SyncOnLoad } from "@/components/dashboard/sync-on-load";

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
        <div className="min-w-0 flex-1 space-y-6">
          <DashboardShell
            stats={data.stats}
            assignments={data.upcomingAssignmentEvents}
            exams={data.upcomingEvents}
            announcements={data.recentAnnouncements}
            upcomingEvents={data.upcomingEvents}
            todaysSchedule={data.todaysSchedule}
            agentActions={data.agentActions}
          />
        </div>

        <aside className="flex w-full shrink-0 flex-col lg:w-64 xl:w-72">
          <div className="flex-1 lg:sticky lg:top-6">
            <PinnedResources resources={data.pinnedResources} />
          </div>
        </aside>
      </div>
    </div>
  );
}
