import { getRole } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SyncOnLoad } from "@/components/dashboard/sync-on-load";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — Nexus",
};

export default async function DashboardPage() {
  const [role, data] = await Promise.all([getRole(), getDashboardData()]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <DashboardGreeting
          todaysSchedule={data.todaysSchedule}
          upcomingEvents={data.upcomingEvents}
        />
        <SyncOnLoad role={role} />
      </header>

      <DashboardShell
        stats={data.stats}
        assignments={data.upcomingAssignmentEvents}
        exams={data.upcomingEvents}
        announcements={data.recentAnnouncements}
        upcomingEvents={data.upcomingEvents}
        todaysSchedule={data.todaysSchedule}
        weekEvents={data.weekEvents}
        agentActions={data.agentActions}
        pinnedResources={data.pinnedResources}
      />
    </div>
  );
}
