"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventBadge } from "@/components/dashboard/event-badge";
import { PlatformPill } from "@/components/dashboard/platform-pill";
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
  const end = event.end_time ? new Date(event.end_time) : null;

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

          {end && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Ends: </span>
              {format(end, "EEE, MMM d, yyyy 'at' p")}
            </div>
          )}

          {event.description && (
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {event.platform && <PlatformPill platform={event.platform} />}
            {event.is_auto_detected && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Auto-detected
              </span>
            )}
            {event.source_url && (
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary underline underline-offset-2"
              >
                View original announcement
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
