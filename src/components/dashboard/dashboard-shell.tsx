"use client";

import { useState, useCallback } from "react";
import { QuickStats } from "./quick-stats";
import { RecentAnnouncements } from "./recent-announcements";
import { AnnouncementsModal } from "./announcements-modal";
import { UpcomingEvents } from "./upcoming-events";
import { TodaysSchedule } from "./todays-schedule";
import { AgentActions } from "./agent-actions";
import type { DashboardAnnouncement, DashboardData, DashboardEvent } from "@/lib/dashboard";

export function DashboardShell({
  stats,
  assignments,
  exams,
  announcements,
  upcomingEvents,
  todaysSchedule,
  agentActions,
}: {
  stats: DashboardData["stats"];
  assignments: DashboardEvent[];
  exams: DashboardEvent[];
  announcements: DashboardAnnouncement[];
  upcomingEvents: DashboardEvent[];
  todaysSchedule: DashboardEvent[];
  agentActions: DashboardData["agentActions"];
}) {
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announcementScrollToId, setAnnouncementScrollToId] = useState<string | null>(null);

  const handleViewAll = useCallback((id: string) => {
    setAnnouncementScrollToId(id);
    setAnnouncementsOpen(true);
  }, []);

  return (
    <>
      <QuickStats stats={stats} assignments={assignments} exams={exams} onAnnouncementsClick={() => { setAnnouncementScrollToId(null); setAnnouncementsOpen(true); }} />

      <div className="grid gap-6 lg:grid-cols-3">
        <UpcomingEvents events={upcomingEvents} className="lg:col-span-2" />
        <TodaysSchedule events={todaysSchedule} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <RecentAnnouncements items={announcements} className="lg:col-span-2" onViewAll={handleViewAll} />
        <AgentActions items={agentActions} />
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
