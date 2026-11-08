"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ExternalLinkIcon, Megaphone01Icon, InboxIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { AnnouncementMeta } from "@/components/dashboard/announcement-meta";
import { formatPlatform } from "@/components/dashboard/platform-pill";
import { cn } from "@/lib/utils";
import type { DashboardAnnouncement } from "@/lib/dashboard";

const BATCH_SIZE = 8;

export function RecentAnnouncements({
  items,
  className,
  onViewAll,
}: {
  items: DashboardAnnouncement[];
  className?: string;
  onViewAll?: (id: string) => void;
}) {
  const [platform, setPlatform] = useState("all");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [prevPlatform, setPrevPlatform] = useState(platform);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const platformOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.platform).filter(Boolean))) as string[],
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (platform !== "all" && item.platform !== platform) return false;
      return true;
    });
  }, [items, platform]);

  if (platform !== prevPlatform) {
    setPrevPlatform(platform);
    setVisibleCount(BATCH_SIZE);
  }

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(filtered.length, count + BATCH_SIZE));
        }
      },
      { root }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  const platformItems = [
    { value: "all", label: "All platforms" },
    ...platformOptions.map((p) => ({ value: p, label: formatPlatform(p) })),
  ];

  return (
    <DashboardCard
      icon={Megaphone01Icon}
      title="Announcements"
      className={cn("self-start", className)}
      action={
        platformOptions.length > 0 && (
          <Select items={platformItems} value={platform} onValueChange={(v) => v && setPlatform(v)}>
            <SelectTrigger size="sm" aria-label="Filter by platform" className="min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {platformItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
    >
      {items.length === 0 || filtered.length === 0 ? (
        <Empty className="p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={InboxIcon} />
            </EmptyMedia>
            <EmptyTitle className="text-base">
              {items.length === 0 ? "Inbox zero" : "No matches"}
            </EmptyTitle>
            <EmptyDescription>
              {items.length === 0
                ? "Announcements from your connected platforms will land here."
                : "No announcements from that platform yet."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          ref={scrollContainerRef}
          className="max-h-80 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-none"
        >
          <ul className="flex min-h-full flex-col divide-y divide-border">
            {visible.map((item) => (
              <li
                key={item.id}
                className="flex flex-1 flex-col justify-center py-1 first:pt-0 last:pb-0"
              >
                <Button
                  variant="ghost"
                  onClick={() => onViewAll?.(item.id)}
                  className="-mx-2 h-auto w-[calc(100%+1rem)] flex-col items-stretch justify-start gap-0 px-2 py-2.5 text-left whitespace-normal"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">
                      {item.title || "Announcement"}
                    </span>
                    {item.source_url && (
                      <HugeiconsIcon
                        icon={ExternalLinkIcon}
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                    )}
                  </span>
                  <span className="mt-1 mb-2 line-clamp-3 text-xs leading-relaxed font-normal whitespace-pre-wrap text-muted-foreground">
                    {item.ai_summary || item.content}
                  </span>
                  <AnnouncementMeta item={item} />
                </Button>
              </li>
            ))}
          </ul>
          {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
        </div>
      )}
    </DashboardCard>
  );
}
