"use client";

import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventBadge } from "@/components/dashboard/event-badge";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./calendar-view";

const PILL_CLASS: Record<string, string> = {
  exam: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  quiz: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  assignment: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  study_block: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  other: "bg-muted text-muted-foreground",
};

function formatTime(iso: string) {
  return format(new Date(iso), "p");
}

export function DayEventsDialog({
  open,
  onOpenChange,
  date,
  events,
  onEdit,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  events: CalendarEvent[];
  onEdit: (ev: CalendarEvent) => void;
  onAdd: () => void;
}) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Calendar03Icon} className="h-4 w-4" />
            {format(date, "EEEE, MMMM d")}
          </DialogTitle>
          <DialogDescription>
            {sorted.length === 0
              ? "Nothing scheduled. Add an event to plan your day."
              : `${sorted.length} event${sorted.length === 1 ? "" : "s"} on this day.`}
          </DialogDescription>
        </DialogHeader>

        {sorted.length > 0 ? (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {sorted.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => onEdit(ev)}
                  className="flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent"
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-medium",
                      PILL_CLASS[ev.event_type] ?? PILL_CLASS.other
                    )}
                  >
                    {formatTime(ev.start_time)}
                    {ev.end_time ? `–${formatTime(ev.end_time)}` : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <EventBadge type={ev.event_type} />
                      <span className="truncate font-medium">{ev.title}</span>
                    </div>
                    {ev.description && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {ev.description}
                      </div>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button onClick={onAdd} className="w-full sm:w-auto">
            <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4" />
            Add event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
