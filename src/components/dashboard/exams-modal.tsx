"use client";

import { format, formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { CalendarClockIcon } from "@hugeicons/core-free-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventBadge } from "@/components/dashboard/event-badge";
import type { DashboardEvent } from "@/lib/dashboard";

function ExamRow({ event }: { event: DashboardEvent }) {
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;

  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">{event.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {format(start, "EEE, MMM d, yyyy 'at' p")}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <EventBadge type={event.event_type} />
          <span className="text-xs font-medium text-primary">
            {formatDistanceToNow(start, { addSuffix: true })}
          </span>
        </div>
      </div>

      {(event.description || end) && (
        <div className="mt-2 space-y-1.5 border-t pt-2 text-sm">
          {event.description && (
            <p className="text-muted-foreground leading-relaxed">{event.description}</p>
          )}
          {end && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Ends:</span>
              <span>{format(end, "EEE, MMM d, yyyy 'at' p")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExamsModal({
  open,
  onOpenChange,
  exams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exams: DashboardEvent[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl !duration-0 data-open:animate-none data-closed:animate-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={CalendarClockIcon} className="h-5 w-5 text-primary" />
            Upcoming exams &amp; quizzes
          </DialogTitle>
        </DialogHeader>

        {exams.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No upcoming exams or quizzes. You&apos;re clear.
          </p>
        ) : (
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {exams.map((event) => (
              <ExamRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
