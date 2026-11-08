"use client";

import { useMemo, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
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
    <DashboardCard
      icon={Calendar03Icon}
      title="Your week ahead"
      action={
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/calendar" />}
          className="text-muted-foreground"
        >
          Open calendar
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
      }
    >
      <div>
        <div className="-mx-1 grid auto-cols-[minmax(7rem,1fr)] grid-flow-col gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
          {days.length === 0 &&
            Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          {days.map(({ date, events: dayEvents }, i) => {
            const isToday = i === 0;
            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "flex min-h-32 flex-col gap-1.5 rounded-lg border p-2",
                  isToday
                    ? "border-primary/40 bg-primary/8 shadow-xs ring-1 ring-primary/15"
                    : "bg-card"
                )}
              >
                <div className="flex items-baseline justify-between px-0.5">
                  <span
                    className={cn(
                      "text-[11px] font-semibold tracking-wide uppercase",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {isToday ? "Today" : format(date, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "font-heading text-lg leading-none font-semibold tabular-nums",
                      isToday ? "text-primary" : "text-foreground/80"
                    )}
                  >
                    {format(date, "d")}
                  </span>
                </div>
                {dayEvents.length === 0 ? (
                  <span className="mt-auto px-0.5 text-[11px] text-muted-foreground">Free</span>
                ) : (
                  <>
                    {dayEvents.slice(0, MAX_CHIPS).map((ev) => {
                      const meta = EVENT_META[ev.event_type] ?? EVENT_META.other;
                      return (
                        <Button
                          key={ev.id}
                          variant="tint"
                          onClick={() => setSelected(ev)}
                          title={ev.title}
                          className={cn(
                            "h-auto w-full justify-start rounded-md px-1.5 py-1 text-left text-[11px] font-medium",
                            meta.className
                          )}
                        >
                          <span className="truncate">{ev.title}</span>
                        </Button>
                      );
                    })}
                    {dayEvents.length > MAX_CHIPS && (
                      <Link
                        href="/calendar"
                        className="px-0.5 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
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
      </div>
      <EventDetailModal event={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </DashboardCard>
  );
}
