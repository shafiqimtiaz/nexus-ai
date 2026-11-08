"use client";

import { format, formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CalendarClockIcon,
  ChevronDownIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { EventBadge } from "@/components/dashboard/event-badge";
import { EventDetails } from "@/components/dashboard/event-details";
import type { DashboardEvent } from "@/lib/dashboard";

export function UpcomingEvents({
  events,
  className,
}: {
  events: DashboardEvent[];
  className?: string;
}) {
  return (
    <DashboardCard icon={CalendarClockIcon} title="Exams and quizzes ahead" className={className}>
      {events.length === 0 ? (
        <Empty className="p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} />
            </EmptyMedia>
            <EmptyTitle className="text-base">Clear skies</EmptyTitle>
            <EmptyDescription>No exams or quizzes in the next 7 days.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((event) => {
            const start = new Date(event.start_time);
            return (
              <li key={event.id} className="py-1 first:pt-0 last:pb-0">
                <Collapsible>
                  <CollapsibleTrigger className="group/trigger -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <EventBadge type={event.event_type} />
                        <span className="truncate font-medium">{event.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(start, "EEE, MMM d · p")}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-right text-sm font-semibold text-primary">
                        {formatDistanceToNow(start, { addSuffix: true })}
                      </span>
                      <HugeiconsIcon
                        icon={ChevronDownIcon}
                        className="size-4 text-muted-foreground transition-transform group-data-panel-open/trigger:rotate-180"
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pt-1 pb-2">
                      <EventDetails event={event} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
