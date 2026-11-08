"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, Link02Icon, RefreshIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { cn } from "@/lib/utils";
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
    <DashboardCard icon={SparklesIcon} title="Agent activity" className={className}>
      {items.length === 0 ? (
        <Empty className="p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={SparklesIcon} />
            </EmptyMedia>
            <EmptyTitle className="text-base">Quiet for now</EmptyTitle>
            <EmptyDescription>
              When Nexus adds events or saves links on its own, you will see it here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          ref={scrollContainerRef}
          className="max-h-80 min-h-0 overflow-y-auto pr-1 scrollbar-none"
        >
          <ul className="divide-y divide-border">
            {visible.map((item) => {
              let icon = SparklesIcon;
              let tone = "bg-primary/10 text-primary";
              if (item.action_type === "calendar") {
                icon = Calendar03Icon;
                tone = "bg-blue-500/12 text-blue-700 dark:text-blue-300";
              } else if (item.action_type === "resource") {
                icon = Link02Icon;
                tone = "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
              } else if (item.action_type === "sync") {
                icon = RefreshIcon;
                tone = "bg-sky-500/12 text-sky-700 dark:text-sky-300";
              }

              return (
                <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={cn("mt-0.5 rounded-full p-1.5", tone)}>
                    <HugeiconsIcon icon={icon} className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <p className="mt-0.5 text-xs break-words text-muted-foreground">
                      {item.description}
                    </p>
                    <span className="mt-1 block text-[11px] text-muted-foreground/70">
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
    </DashboardCard>
  );
}
