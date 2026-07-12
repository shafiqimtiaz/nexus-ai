"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventBadge } from "@/components/dashboard/event-badge";
import { EventDetailModal } from "@/components/dashboard/event-detail-modal";
import type { DashboardEvent } from "@/lib/dashboard";

export function UpcomingEvents({
  events,
  className,
}: {
  events: DashboardEvent[];
  className?: string;
}) {
  const [selected, setSelected] = useState<DashboardEvent | null>(null);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={Calendar03Icon} className="h-4 w-4 text-primary" />
          Upcoming exams &amp; quizzes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No exams or quizzes in the next 7 days. You&apos;re clear.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const start = new Date(event.start_time);
              return (
                <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setSelected(event)}
                    className="flex w-full items-center justify-between gap-4 rounded text-left transition-colors hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <EventBadge type={event.event_type} />
                        <span className="truncate font-medium">{event.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(start, "EEE, MMM d · p")}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-medium text-primary">
                      {formatDistanceToNow(start, { addSuffix: true })}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <EventDetailModal event={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </Card>
  );
}
