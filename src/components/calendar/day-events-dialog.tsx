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
import { EventBadge, EVENT_META } from "@/components/dashboard/event-badge";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./calendar-view";

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
            <HugeiconsIcon icon={Calendar03Icon} className="size-4 text-primary" />
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
                <Button
                  variant="ghost"
                  onClick={() => onEdit(ev)}
                  className="h-auto w-full items-start justify-start gap-3 p-2 text-left whitespace-normal"
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-medium",
                      (EVENT_META[ev.event_type] ?? EVENT_META.other).className
                    )}
                  >
                    {formatTime(ev.start_time)}
                    {ev.end_time ? `–${formatTime(ev.end_time)}` : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <EventBadge type={ev.event_type} />
                      <span className="truncate font-medium">{ev.title}</span>
                    </span>
                    {ev.description && (
                      <span className="mt-0.5 line-clamp-2 block text-xs font-normal text-muted-foreground">
                        {ev.description}
                      </span>
                    )}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button onClick={onAdd} className="w-full sm:w-auto">
            <HugeiconsIcon icon={PlusSignIcon} />
            Add event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
