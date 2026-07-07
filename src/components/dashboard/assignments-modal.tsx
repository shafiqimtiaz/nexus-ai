"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ClipboardListIcon } from "@hugeicons/core-free-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventBadge } from "@/components/dashboard/event-badge";
import { cn } from "@/lib/utils";
import type { DashboardEvent } from "@/lib/dashboard";

function AssignmentRow({ event }: { event: DashboardEvent }) {
  const [expanded, setExpanded] = useState(false);
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  const hasDetails = !!event.description || !!end;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
          expanded && "rounded-b-none"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium">{event.title}</span>
            <span className="text-xs text-muted-foreground">
              {format(start, "EEE, MMM d · p")} &mdash;{" "}
              {formatDistanceToNow(start, { addSuffix: true })}
            </span>
          </div>
        </div>
        <EventBadge type={event.event_type} />
      </button>

      {expanded && hasDetails && (
        <div className="border-t px-4 py-3 space-y-2 text-sm">
          {event.description && (
            <p className="text-muted-foreground leading-relaxed">{event.description}</p>
          )}
          {end && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Due:</span>
              <span>{format(end, "EEE, MMM d, yyyy 'at' p")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AssignmentsModal({
  open,
  onOpenChange,
  assignments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: DashboardEvent[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl !duration-0 data-open:animate-none data-closed:animate-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={ClipboardListIcon} className="h-5 w-5 text-primary" />
            Upcoming assignments
          </DialogTitle>
        </DialogHeader>

        {assignments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No upcoming assignments. Enjoy the break.
          </p>
        ) : (
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {assignments.map((event) => (
              <AssignmentRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
