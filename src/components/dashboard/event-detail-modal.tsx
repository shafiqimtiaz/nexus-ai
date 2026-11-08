"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventBadge } from "@/components/dashboard/event-badge";
import { EventDetails } from "@/components/dashboard/event-details";
import type { DashboardEvent } from "@/lib/dashboard";

export function EventDetailModal({
  event,
  onOpenChange,
}: {
  event: DashboardEvent | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!event) return null;
  const start = new Date(event.start_time);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg !duration-0 data-open:animate-none data-closed:animate-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EventBadge type={event.event_type} />
            <span className="min-w-0 truncate">{event.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium">{format(start, "EEE, MMM d, yyyy 'at' p")}</div>
            <div className="text-xs text-primary">
              {formatDistanceToNow(start, { addSuffix: true })}
            </div>
          </div>

          <EventDetails event={event} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
