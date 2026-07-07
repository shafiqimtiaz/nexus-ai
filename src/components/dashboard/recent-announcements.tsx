"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ExternalLinkIcon,
  Megaphone01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardAnnouncement } from "@/lib/dashboard";

const PAGE_SIZE = 5;

const SELECT_CLASS =
  "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const PLATFORM_LABELS: Record<string, string> = {
  google_classroom: "Google Classroom",
  discord: "Discord",
  slack: "Slack",
};

const PLATFORM_STYLES: Record<string, string> = {
  google_classroom: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  discord: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  slack: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

const PILL_BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 font-medium";

function formatPlatform(type: string): string {
  return PLATFORM_LABELS[type] ?? type;
}

export function RecentAnnouncements({ items, className }: { items: DashboardAnnouncement[]; className?: string }) {
  const [page, setPage] = useState(0);
  const [platform, setPlatform] = useState("all");
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function resetPageThen<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Megaphone01Icon} className="h-4 w-4 text-primary" />
            Recent announcements
          </CardTitle>
          <div className="flex items-center gap-2">
            {platformOptions.length > 0 && (
              <select
                value={platform}
                onChange={(e) => resetPageThen(setPlatform)(e.target.value)}
                className={SELECT_CLASS}
                aria-label="Filter by platform"
              >
                <option value="all">All platforms</option>
                {platformOptions.map((p) => (
                  <option key={p} value={p}>
                    {formatPlatform(p)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {items.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            No announcements yet.
          </p>
        ) : (
          <>
            {filtered.length === 0 ? (
              <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
                No announcements match these filters.
              </p>
            ) : (
            <>
            <ul className="flex flex-1 flex-col divide-y divide-border">
              {visible.map((item) => {
                const body = (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {item.title || "Announcement"}
                      </span>
                      {item.source_url && (
                        <HugeiconsIcon
                          icon={ExternalLinkIcon}
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        />
                      )}
                    </div>
                    {item.content && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.content}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {item.author && (
                        <span className={cn(PILL_BASE, "bg-blue-500/10 text-blue-600 dark:text-blue-400")}>
                          {item.author}
                        </span>
                      )}
                      {item.announced_at && (
                        <span className={cn(PILL_BASE, "bg-muted text-muted-foreground")}>
                          {formatDistanceToNow(new Date(item.announced_at), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                      {item.channel && (
                        <span className={cn(PILL_BASE, "bg-muted text-muted-foreground")}>
                          {item.channel}
                        </span>
                      )}
                      {item.platform && (
                        <span
                          className={cn(
                            PILL_BASE,
                            PLATFORM_STYLES[item.platform] ??
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {formatPlatform(item.platform)}
                        </span>
                      )}
                    </div>
                  </>
                );

                return (
                  <li
                    key={item.id}
                    className="flex flex-1 flex-col justify-center py-3 first:pt-0 last:pb-0"
                  >
                    {item.source_url ? (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block cursor-pointer rounded-md transition-colors hover:bg-muted/60"
                      >
                        {body}
                      </a>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>

            {pageCount > 1 && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  Page {current + 1} of {pageCount}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={current === 0}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={current >= pageCount - 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
