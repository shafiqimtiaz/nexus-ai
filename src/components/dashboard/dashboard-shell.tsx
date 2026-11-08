"use client";

import { useState, useCallback } from "react";
import { QuickStats } from "./quick-stats";
import { RecentAnnouncements } from "./recent-announcements";
import { AnnouncementsModal } from "./announcements-modal";
import { UpcomingEvents } from "./upcoming-events";
import { TodaysSchedule } from "./todays-schedule";
import { AgentActions } from "./agent-actions";
import { WeekAhead } from "./week-ahead";
import { PinnedResources } from "./pinned-resources";
import type { DashboardAnnouncement, DashboardData, DashboardEvent } from "@/lib/dashboard";

export function DashboardShell({
  stats,
  assignments,
  exams,
  announcements,
  upcomingEvents,
  todaysSchedule,
  weekEvents,
  agentActions,
  pinnedResources,
}: {
  stats: DashboardData["stats"];
  assignments: DashboardEvent[];
  exams: DashboardEvent[];
  announcements: DashboardAnnouncement[];
  upcomingEvents: DashboardEvent[];
  todaysSchedule: DashboardEvent[];
  weekEvents: DashboardEvent[];
  agentActions: DashboardData["agentActions"];
  pinnedResources: DashboardData["pinnedResources"];
}) {
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announcementScrollToId, setAnnouncementScrollToId] = useState<string | null>(null);

  const handleViewAll = useCallback((id: string) => {
    setAnnouncementScrollToId(id);
    setAnnouncementsOpen(true);
  }, []);

  return (
    <>
      <QuickStats
        stats={stats}
        assignments={assignments}
        exams={exams}
        onAnnouncementsClick={() => {
          setAnnouncementScrollToId(null);
          setAnnouncementsOpen(true);
        }}
      />

      <WeekAhead events={weekEvents} />

      <div className="grid gap-6 lg:grid-cols-3">
        <UpcomingEvents events={upcomingEvents} className="lg:col-span-2" />
        <TodaysSchedule events={todaysSchedule} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <RecentAnnouncements
          items={announcements}
          className="lg:col-span-2"
          onViewAll={handleViewAll}
        />
        <div className="flex flex-col gap-6">
          <AgentActions items={agentActions} />
          <PinnedResources resources={pinnedResources} />
        </div>
      </div>

      <AnnouncementsModal
        open={announcementsOpen}
        onOpenChange={(o) => {
          setAnnouncementsOpen(o);
          if (!o) setAnnouncementScrollToId(null);
        }}
        initialScrollToId={announcementScrollToId}
      />
    </>
  );
}
