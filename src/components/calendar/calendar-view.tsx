"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EVENT_META } from "@/components/dashboard/event-badge";
import { UpcomingList } from "@/components/calendar/upcoming-list";
import { PageHeader } from "@/components/layout/page-header";
import { EventForm } from "@/components/calendar/event-form";
import { DayEventsDialog } from "@/components/calendar/day-events-dialog";
import type { EventType } from "@/lib/dashboard";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_time: string;
  end_time: string | null;
  source_platform: string | null;
  source_external_id: string | null;
  is_auto_detected: boolean;
  created_at: string;
  status?: "confirmed" | "cancelled";
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PILLS = 3;

async function fetchEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const res = await fetch(`/api/events?from=${from}&to=${to}`);
  if (!res.ok) throw new Error("Failed to load events");
  const json = await res.json();
  return json.events ?? [];
}

async function fetchUpcoming(): Promise<CalendarEvent[]> {
  const res = await fetch("/api/events");
  if (!res.ok) throw new Error("Failed to load events");
  const json = await res.json();
  return json.events ?? [];
}

type DialogState =
  | { mode: "create"; date: Date }
  | { mode: "edit"; event: CalendarEvent }
  | { mode: "day"; date: Date; events: CalendarEvent[] }
  | null;

export function CalendarView({ role }: { role: Role }) {
  const canEdit = role === "owner" || role === "demo";
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [dialog, setDialog] = useState<DialogState>(null);

  const gridStart = useMemo(() => startOfWeek(startOfMonth(currentMonth)), [currentMonth]);
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 41) }),
    [gridStart]
  );

  const monthKey = format(currentMonth, "yyyy-MM");
  const from = gridStart.toISOString();
  const to = addDays(gridStart, 42).toISOString();

  const { data: events = [] } = useQuery({
    queryKey: ["events", "month", monthKey],
    queryFn: () => fetchEvents(from, to),
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: fetchUpcoming,
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = format(new Date(ev.start_time), "yyyy-MM-dd");
      const list = map.get(key);
      if (list) list.push(ev);
      else map.set(key, [ev]);
    }
    return map;
  }, [events]);

  const [cutoff] = useState(() => Date.now());
  const upcoming = useMemo(() => {
    return allEvents
      .filter((ev) => ev.status !== "cancelled" && new Date(ev.start_time).getTime() >= cutoff)
      .slice(0, 10);
  }, [allEvents, cutoff]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Calendar"
        title="Your term, mapped out"
        description="Exams, deadlines, and study blocks in one place. Click any day to see or add what's on."
        actions={
          canEdit && (
            <Button onClick={() => setDialog({ mode: "create", date: new Date() })}>
              <HugeiconsIcon icon={PlusSignIcon} />
              Add event
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{format(currentMonth, "MMMM yyyy")}</CardTitle>
              <CardAction className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous month"
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next month"
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(EVENT_META).map(([type, meta]) => (
                  <span
                    key={type}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                  >
                    <span className={cn("size-2 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="pb-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const extra = dayEvents.length - MAX_PILLS;

                  return (
                    <div
                      key={key}
                      onClick={
                        canEdit
                          ? () => setDialog({ mode: "day", date: day, events: dayEvents })
                          : undefined
                      }
                      className={cn(
                        "min-h-24 border-b border-r p-1 sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                        !inMonth && "bg-muted/30 text-muted-foreground",
                        canEdit && "cursor-pointer transition-colors hover:bg-accent"
                      )}
                    >
                      <div className="mb-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={!canEdit}
                          aria-label={format(day, "EEEE, MMMM d")}
                          aria-current={today ? "date" : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialog({ mode: "day", date: day, events: dayEvents });
                          }}
                          className={cn(
                            "size-6 rounded-full text-xs",
                            today &&
                              "bg-primary font-semibold text-primary-foreground hover:bg-primary/85 hover:text-primary-foreground disabled:opacity-100"
                          )}
                        >
                          {format(day, "d")}
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, MAX_PILLS).map((ev) => (
                          <Button
                            key={ev.id}
                            variant="tint"
                            disabled={!canEdit}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDialog({ mode: "edit", event: ev });
                            }}
                            title={ev.title}
                            className={cn(
                              "h-auto w-full justify-start rounded px-1.5 py-0.5 text-xs font-medium disabled:opacity-100",
                              (EVENT_META[ev.event_type] ?? EVENT_META.other).className,
                              ev.status === "cancelled" && "line-through opacity-50"
                            )}
                          >
                            <span className="truncate">{ev.title}</span>
                          </Button>
                        ))}
                        {extra > 0 && (
                          <div className="px-1.5 text-xs text-muted-foreground">+{extra} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <UpcomingList
          events={upcoming}
          onSelect={canEdit ? (ev) => setDialog({ mode: "edit", event: ev }) : undefined}
        />
      </div>

      {canEdit && dialog && dialog.mode === "day" && (
        <DayEventsDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          date={dialog.date}
          events={dialog.events}
          onEdit={(ev) => setDialog({ mode: "edit", event: ev })}
          onAdd={() => setDialog({ mode: "create", date: dialog.date })}
        />
      )}

      {canEdit && dialog && dialog.mode !== "day" && (
        <EventForm
          key={dialog.mode === "edit" ? dialog.event.id : `create-${dialog.date.toISOString()}`}
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          event={dialog.mode === "edit" ? dialog.event : null}
          defaultDate={dialog.mode === "create" ? dialog.date : undefined}
        />
      )}
    </div>
  );
}
