"use client";

import { useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Notification03Icon,
  CalendarClockIcon,
  ClipboardListIcon,
} from "@hugeicons/core-free-icons";
import { Card, CardContent } from "@/components/ui/card";
import { AssignmentsModal } from "@/components/dashboard/assignments-modal";
import { AnnouncementsModal } from "@/components/dashboard/announcements-modal";
import { cn } from "@/lib/utils";
import type { DashboardData, DashboardEvent } from "@/lib/dashboard";

function Stat({
  icon,
  value,
  label,
  onClick,
}: {
  icon: IconSvgElement;
  value: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "relative",
        onClick && "cursor-pointer transition-colors hover:bg-accent/50"
      )}
    >
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          className="absolute inset-0 z-10"
          aria-label={label}
        />
      )}
      <CardContent className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HugeiconsIcon icon={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickStats({
  stats,
  assignments,
}: {
  stats: DashboardData["stats"];
  assignments: DashboardEvent[];
}) {
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={CalendarClockIcon}
          value={
            stats.daysToNextExam === null
              ? "—"
              : stats.daysToNextExam === 0
                ? "Today"
                : String(stats.daysToNextExam)
          }
          label={
            stats.daysToNextExam === null || stats.daysToNextExam === 0
              ? "Next exam"
              : stats.daysToNextExam === 1
                ? "Day to next exam"
                : "Days to next exam"
          }
        />
        <Stat
          icon={Notification03Icon}
          value={String(stats.unreadAnnouncements)}
          label="Unread announcements"
          onClick={() => setAnnouncementsOpen(true)}
        />
        <Stat
          icon={ClipboardListIcon}
          value={String(stats.upcomingAssignments)}
          label="Upcoming assignments"
          onClick={() => setAssignmentsOpen(true)}
        />
      </div>

      <AssignmentsModal
        open={assignmentsOpen}
        onOpenChange={setAssignmentsOpen}
        assignments={assignments}
      />

      <AnnouncementsModal
        open={announcementsOpen}
        onOpenChange={setAnnouncementsOpen}
      />
    </>
  );
}
