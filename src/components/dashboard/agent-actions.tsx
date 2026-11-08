"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, Link02Icon, RefreshIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardAgentAction } from "@/lib/dashboard";

const BATCH_SIZE = 16;

export function AgentActions({
  items,
  className,
}: {
  items: DashboardAgentAction[];
  className?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const visible = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(items.length, count + BATCH_SIZE));
        }
      },
      { root }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, items.length]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={SparklesIcon} className="h-4 w-4 text-amber-500 animate-pulse" />
          Agent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No autonomous actions logged yet. Synced updates will trigger concierge actions.
          </p>
        ) : (
          <div
            ref={scrollContainerRef}
            className="max-h-80 min-h-0 overflow-y-auto scrollbar-none pr-1"
          >
            <ul className="divide-y divide-border">
              {visible.map((item) => {
                let icon = SparklesIcon;
                let iconColor = "text-amber-500";
                if (item.action_type === "calendar") {
                  icon = Calendar03Icon;
                  iconColor = "text-blue-500";
                } else if (item.action_type === "resource") {
                  icon = Link02Icon;
                  iconColor = "text-emerald-500";
                } else if (item.action_type === "sync") {
                  icon = RefreshIcon;
                  iconColor = "text-cyan-500";
                }

                return (
                  <li key={item.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                    <div className={`mt-0.5 rounded-full bg-muted p-1.5 ${iconColor}`}>
                      <HugeiconsIcon icon={icon} className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground block truncate">
                        {item.title}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">
                        {item.description}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
