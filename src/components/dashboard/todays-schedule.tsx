"use client";

import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { CalendarCheckIcon, ChevronDownIcon, Sun03Icon } from "@hugeicons/core-free-icons";
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

export function TodaysSchedule({
  events,
  className,
}: {
  events: DashboardEvent[];
  className?: string;
}) {
  return (
    <DashboardCard icon={CalendarCheckIcon} title="On today" className={className}>
      {events.length === 0 ? (
        <Empty className="p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Sun03Icon} />
            </EmptyMedia>
            <EmptyTitle className="text-base">A free day</EmptyTitle>
            <EmptyDescription>Nothing scheduled. Good time for a study block.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((event) => (
            <li key={event.id} className="py-1 first:pt-0 last:pb-0">
              <Collapsible>
                <CollapsibleTrigger className="group/trigger -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50">
                  <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {format(new Date(event.start_time), "p")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{event.title}</div>
                    <div className="mt-1">
                      <EventBadge type={event.event_type} />
                    </div>
                  </div>
                  <HugeiconsIcon
                    icon={ChevronDownIcon}
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open/trigger:rotate-180"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-1 pb-2">
                    <EventDetails event={event} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
