"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventBadge } from "@/components/dashboard/event-badge";
import { PlatformPill } from "@/components/dashboard/platform-pill";
import type { DashboardEvent } from "@/lib/dashboard";

export function UpcomingEvents({
  events,
  className,
}: {
  events: DashboardEvent[];
  className?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={Calendar03Icon} className="h-4 w-4 text-primary" />
          Upcoming exams &amp; quizzes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No exams or quizzes in the next 7 days. You&apos;re clear.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const start = new Date(event.start_time);
              const end = event.end_time ? new Date(event.end_time) : null;
              const isOpen = expandedId === event.id;
              return (
                <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : event.id)}
                    className="flex w-full items-center justify-between gap-4 rounded text-left transition-colors hover:opacity-80"
                  >
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
                      <span className="text-right text-sm font-medium text-primary">
                        {formatDistanceToNow(start, { addSuffix: true })}
                      </span>
                      <svg
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-3 space-y-2 rounded-md border bg-muted/30 px-3 py-3 text-sm">
                      {event.description && (
                        <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                      {end && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">Ends: </span>
                          {format(end, "EEE, MMM d, yyyy 'at' p")}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {event.platform && <PlatformPill platform={event.platform} />}
                        {event.is_auto_detected && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Auto-detected
                          </span>
                        )}
                        {event.source_url && (
                          <a
                            href={event.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary underline underline-offset-2"
                          >
                            View original announcement
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
