"use client";

import { useHydrated } from "@/lib/use-hydrated";
import { format, isToday, isTomorrow } from "date-fns";
import type { DashboardEvent } from "@/lib/dashboard";

function greetingFor(hour: number) {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function summarize(today: DashboardEvent[], upcoming: DashboardEvent[]) {
  const parts: string[] = [];
  const remaining = today.filter((e) => new Date(e.start_time).getTime() > Date.now());
  if (today.length === 0) parts.push("Nothing on your schedule today");
  else if (remaining.length === 0) parts.push("You're done for today");
  else parts.push(`${remaining.length} more ${remaining.length === 1 ? "item" : "items"} today`);

  const next = upcoming[0];
  if (next) {
    const when = new Date(next.start_time);
    const day = isToday(when) ? "today" : isTomorrow(when) ? "tomorrow" : format(when, "EEEE");
    parts.push(`${next.title} is ${day} at ${format(when, "p")}`);
  }
  return parts.join(" · ");
}

export function DashboardGreeting({
  todaysSchedule,
  upcomingEvents,
}: {
  todaysSchedule: DashboardEvent[];
  upcomingEvents: DashboardEvent[];
}) {
  // Rendered after mount so the greeting and times use the viewer's clock, not the server's.
  const now = useHydrated() ? new Date() : null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-primary">
        {now ? format(now, "EEEE, MMMM d") : " "}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {now ? greetingFor(now.getHours()) : "Welcome back"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {now ? summarize(todaysSchedule, upcomingEvents) : " "}
      </p>
    </div>
  );
}
