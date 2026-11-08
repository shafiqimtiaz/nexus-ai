"use client";

import { useMemo, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_META } from "@/components/dashboard/event-badge";
import { EventDetailModal } from "@/components/dashboard/event-detail-modal";
import type { DashboardEvent } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const MAX_CHIPS = 3;

export function WeekAhead({ events }: { events: DashboardEvent[] }) {
  const [selected, setSelected] = useState<DashboardEvent | null>(null);
  // Day buckets depend on the viewer's timezone, so build them on the client.
  const hydrated = useHydrated();

  const days = useMemo(() => {
    if (!hydrated) return [];
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i);
      return { date, events: events.filter((e) => isSameDay(new Date(e.start_time), date)) };
    });
  }, [events, hydrated]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={Calendar03Icon} className="h-4 w-4 text-primary" />
          Week ahead
        </CardTitle>
        <Link
          href="/calendar"
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          Open calendar
          <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="-mx-1 grid auto-cols-[minmax(6.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
          {days.length === 0 &&
            Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-muted/50" />
            ))}
          {days.map(({ date, events: dayEvents }, i) => {
            const isToday = i === 0;
            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "flex min-h-32 flex-col gap-1.5 rounded-lg border p-2",
                  isToday ? "border-primary/40 bg-primary/5" : "bg-muted/20"
                )}
              >
                <div className="flex items-baseline justify-between px-0.5">
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {isToday ? "Today" : format(date, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isToday ? "text-primary" : "text-foreground/80"
                    )}
                  >
                    {format(date, "d")}
                  </span>
                </div>
                {dayEvents.length === 0 ? (
                  <span className="mt-auto px-0.5 text-[11px] text-muted-foreground/60">Free</span>
                ) : (
                  <>
                    {dayEvents.slice(0, MAX_CHIPS).map((ev) => {
                      const meta = EVENT_META[ev.event_type] ?? EVENT_META.other;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => setSelected(ev)}
                          title={ev.title}
                          className={cn(
                            "w-full cursor-pointer truncate rounded-md px-1.5 py-1 text-left text-[11px] font-medium transition-opacity hover:opacity-80",
                            meta.className
                          )}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                    {dayEvents.length > MAX_CHIPS && (
                      <Link
                        href="/calendar"
                        className="px-0.5 text-[11px] font-medium text-muted-foreground hover:text-primary"
                      >
                        +{dayEvents.length - MAX_CHIPS} more
                      </Link>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      <EventDetailModal event={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </Card>
  );
}
