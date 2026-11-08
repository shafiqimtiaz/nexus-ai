import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { CalendarCheckIn01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { EventBadge } from "@/components/dashboard/event-badge";
import type { CalendarEvent } from "@/components/calendar/calendar-view";

function UpcomingRow({ event }: { event: CalendarEvent }) {
  return (
    <div className="min-w-0 text-left">
      <div className="flex items-center gap-2">
        <EventBadge type={event.event_type} />
        <span className="truncate font-medium">{event.title}</span>
      </div>
      <div className="mt-1 text-xs font-normal text-muted-foreground">
        {format(new Date(event.start_time), "EEE, MMM d · p")}
      </div>
    </div>
  );
}

export function UpcomingList({
  events,
  onSelect,
}: {
  events: CalendarEvent[];
  onSelect?: (event: CalendarEvent) => void;
}) {
  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="text-xl">Coming up</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <Empty className="p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={CalendarCheckIn01Icon} />
              </EmptyMedia>
              <EmptyTitle className="text-sm">All clear</EmptyTitle>
              <EmptyDescription className="text-xs">Nothing on the horizon.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {events.map((ev) => (
              <li key={ev.id}>
                {onSelect ? (
                  <Button
                    variant="ghost"
                    onClick={() => onSelect(ev)}
                    className="h-auto w-full justify-start px-2 py-2 whitespace-normal"
                  >
                    <UpcomingRow event={ev} />
                  </Button>
                ) : (
                  <div className="px-2 py-2">
                    <UpcomingRow event={ev} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
