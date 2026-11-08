"use client";

import { useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Notification03Icon,
  CalendarClockIcon,
  ClipboardListIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssignmentsModal } from "@/components/dashboard/assignments-modal";
import { ExamsModal } from "@/components/dashboard/exams-modal";
import type { DashboardData, DashboardEvent } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const TONES = {
  red: "bg-red-500/12 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  amber: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  emerald: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
} as const;

function StatBody({
  icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: IconSvgElement;
  value: string;
  label: string;
  detail?: string | null;
  tone: keyof typeof TONES;
}) {
  return (
    <>
      <span
        className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", TONES[tone])}
      >
        <HugeiconsIcon icon={icon} className="size-5" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block font-heading text-4xl leading-none font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        <span className="mt-1.5 block truncate text-xs font-normal text-muted-foreground">
          {label}
        </span>
        {detail && (
          <span className="mt-0.5 block truncate text-xs font-medium text-foreground/80">
            {detail}
          </span>
        )}
      </span>
    </>
  );
}

function Stat(props: React.ComponentProps<typeof StatBody> & { onClick?: () => void }) {
  const { onClick, ...body } = props;
  return (
    <Card className="py-0 transition-all has-[button:enabled]:hover:-translate-y-0.5 has-[button:enabled]:hover:shadow-md">
      <Button
        variant="ghost"
        disabled={!onClick}
        onClick={onClick}
        aria-label={onClick ? props.label : undefined}
        className="h-auto w-full justify-start gap-4 rounded-xl p-4 whitespace-normal disabled:opacity-100"
      >
        <StatBody {...body} />
      </Button>
    </Card>
  );
}

export function QuickStats({
  stats,
  assignments,
  exams,
  onAnnouncementsClick,
}: {
  stats: DashboardData["stats"];
  assignments: DashboardEvent[];
  exams: DashboardEvent[];
  onAnnouncementsClick?: () => void;
}) {
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [examsOpen, setExamsOpen] = useState(false);
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
              ? "Next exam / quiz"
              : stats.daysToNextExam === 1
                ? "Day to next exam / quiz"
                : "Days to next exam / quiz"
          }
          detail={stats.nextExamTitle}
          tone="red"
          onClick={exams.length > 0 ? () => setExamsOpen(true) : undefined}
        />
        <Stat
          icon={Notification03Icon}
          value={String(stats.unreadAnnouncements)}
          label="Unread announcements"
          tone="amber"
          onClick={onAnnouncementsClick}
        />
        <Stat
          icon={ClipboardListIcon}
          value={String(stats.upcomingAssignments)}
          label="Assignments due soon"
          detail={assignments[0] ? `Next: ${assignments[0].title}` : null}
          tone="emerald"
          onClick={assignments.length > 0 ? () => setAssignmentsOpen(true) : undefined}
        />
      </div>

      <AssignmentsModal
        open={assignmentsOpen}
        onOpenChange={setAssignmentsOpen}
        assignments={assignments}
      />

      <ExamsModal open={examsOpen} onOpenChange={setExamsOpen} exams={exams} />
    </>
  );
}
