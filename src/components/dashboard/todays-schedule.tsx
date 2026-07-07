import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { CalendarCheckIcon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventBadge } from "@/components/dashboard/event-badge";
import type { DashboardEvent } from "@/lib/dashboard";

export function TodaysSchedule({ events, className }: { events: DashboardEvent[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={CalendarCheckIcon} className="h-4 w-4 text-primary" />
          Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled today.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-3">
                <span className="w-16 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {format(new Date(event.start_time), "p")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{event.title}</div>
                  <div className="mt-1">
                    <EventBadge type={event.event_type} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
