"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventBadge } from "@/components/dashboard/event-badge";
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
};

// Compact pill colors, matching the dashboard's EventBadge palette so a type
// reads the same everywhere.
const PILL_CLASS: Record<EventType, string> = {
  exam: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  quiz: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  assignment: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  study_block: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  other: "bg-muted text-muted-foreground",
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
  // Demo is now editable too (its writes are isolated to the mock DB).
  const canEdit = role === "owner" || role === "demo";
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [dialog, setDialog] = useState<DialogState>(null);

  // Always render six weeks (42 cells) starting on the Sunday on/before the 1st.
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

  // Group visible events by local day key.
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

  const upcoming = useMemo(() => {
    const now = Date.now();
    return allEvents.filter((ev) => new Date(ev.start_time).getTime() >= now).slice(0, 10);
  }, [allEvents]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Your exams, assignments, and study blocks in one place.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setDialog({ mode: "create", date: new Date() })}>
            <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4" />
            Add event
          </Button>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous month"
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next month"
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
                        "min-h-24 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0",
                        !inMonth && "bg-muted/30 text-muted-foreground",
                        canEdit && "cursor-pointer transition-colors hover:bg-accent"
                      )}
                    >
                      <div className="mb-1 flex justify-end">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                            today && "bg-primary font-semibold text-primary-foreground"
                          )}
                        >
                          {format(day, "d")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, MAX_PILLS).map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            disabled={!canEdit}
                            onClick={
                              canEdit
                                ? (e) => {
                                    e.stopPropagation();
                                    setDialog({ mode: "edit", event: ev });
                                  }
                                : undefined
                            }
                            title={ev.title}
                            className={cn(
                              "block w-full truncate rounded px-1.5 py-0.5 text-left text-xs",
                              PILL_CLASS[ev.event_type] ?? PILL_CLASS.other,
                              canEdit && "cursor-pointer"
                            )}
                          >
                            {ev.title}
                          </button>
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

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nothing coming up.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((ev) => {
                    const start = new Date(ev.start_time);
                    const content = (
                      <>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <EventBadge type={ev.event_type} />
                            <span className="truncate font-medium">{ev.title}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {format(start, "EEE, MMM d · p")}
                          </div>
                        </div>
                      </>
                    );
                    return (
                      <li key={ev.id} className="py-3 first:pt-0 last:pb-0">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setDialog({ mode: "edit", event: ev })}
                            className="w-full rounded text-left transition-colors hover:opacity-80"
                          >
                            {content}
                          </button>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
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
