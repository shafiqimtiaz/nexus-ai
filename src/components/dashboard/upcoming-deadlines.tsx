import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar02Icon, ClipboardListIcon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformPill } from "@/components/dashboard/platform-pill";
import { cn } from "@/lib/utils";
import type { DashboardEvent } from "@/lib/dashboard";

// The deadline is the due time (end_time) when present, else the start_time.
function deadlineOf(event: DashboardEvent): Date {
  return new Date(event.end_time ?? event.start_time);
}

function urgencyClass(days: number): string {
  if (days <= 1) return "text-red-600 dark:text-red-400";
  if (days <= 3) return "text-amber-600 dark:text-amber-400";
  return "text-primary";
}

export function UpcomingDeadlines({
  events,
  className,
}: {
  events: DashboardEvent[];
  className?: string;
}) {
  const now = new Date();

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={ClipboardListIcon} className="h-4 w-4 text-primary" />
          Upcoming assignment deadlines
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No assignments due right now. You&apos;re all caught up.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {events.map((event) => {
              const due = deadlineOf(event);
              const days = differenceInCalendarDays(due, now);
              return (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{event.title}</span>
                      {event.platform && <PlatformPill platform={event.platform} />}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <HugeiconsIcon icon={Calendar02Icon} className="h-3.5 w-3.5" />
                      <span>Due {format(due, "EEE, MMM d · p")}</span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "shrink-0 text-right text-sm font-medium",
                      urgencyClass(days)
                    )}
                  >
                    {formatDistanceToNow(due, { addSuffix: true })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
