"use client";

import { format, formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ClipboardListIcon } from "@hugeicons/core-free-icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventBadge } from "@/components/dashboard/event-badge";
import type { DashboardEvent } from "@/lib/dashboard";

function AssignmentRow({ event }: { event: DashboardEvent }) {
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  const hasDetails = !!event.description || !!end;

  const header = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {hasDetails && (
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open/trigger:rotate-180"
          />
        )}
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">{event.title}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {format(start, "EEE, MMM d · p")} &mdash;{" "}
            {formatDistanceToNow(start, { addSuffix: true })}
          </span>
        </div>
      </div>
      <EventBadge type={event.event_type} />
    </>
  );

  return (
    <Collapsible className="rounded-lg border bg-card">
      <CollapsibleTrigger
        disabled={!hasDetails}
        className="group/trigger flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent"
      >
        {header}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 border-t px-4 py-3 text-sm">
          {event.description && (
            <p className="leading-relaxed text-muted-foreground">{event.description}</p>
          )}
          {end && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Due:</span>
              <span>{format(end, "EEE, MMM d, yyyy 'at' p")}</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
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
            <HugeiconsIcon icon={ClipboardListIcon} className="size-5 text-primary" />
            Upcoming assignments
          </DialogTitle>
          <DialogDescription>What is due soon, soonest first.</DialogDescription>
        </DialogHeader>

        {assignments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing due soon. Enjoy the breathing room.
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
