"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Megaphone01Icon,
  ArrowDown01Icon,
  ExternalLinkIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DashboardAnnouncement } from "@/lib/dashboard";

const PAGE_SIZE = 5;

const PILL_BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

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

function formatPlatform(type: string): string {
  return PLATFORM_LABELS[type] ?? type;
}

function AnnouncementRow({
  item,
}: {
  item: DashboardAnnouncement;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
          expanded && "rounded-b-none"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
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
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {item.author && (
                <span className={cn(PILL_BASE, "bg-blue-500/10 text-blue-600 dark:text-blue-400")}>
                  {item.author}
                </span>
              )}
              {item.announced_at && (
                <span className={cn(PILL_BASE, "bg-muted text-muted-foreground")}>
                  {formatDistanceToNow(new Date(item.announced_at), { addSuffix: true })}
                </span>
              )}
              {item.platform && (
                <span
                  className={cn(
                    PILL_BASE,
                    PLATFORM_STYLES[item.platform] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {formatPlatform(item.platform)}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {expanded && item.content && (
        <div className="border-t px-4 py-3 text-sm">
          <p className="leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {item.content}
          </p>
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <HugeiconsIcon icon={ExternalLinkIcon} className="h-3 w-3" />
              Open in source
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Cache fetch results so reopening the modal is instant
let cachedTotal = 0;
let cachedPage = -1;
let cachedItems: DashboardAnnouncement[] = [];

export function AnnouncementsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState<DashboardAnnouncement[]>(cachedItems);
  const [total, setTotal] = useState(cachedTotal);
  const [page, setPage] = useState(0);
  const [fetching, setFetching] = useState(false);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchPage = useCallback(async (p: number) => {
    // Return cached page immediately if available
    if (p === cachedPage && cachedItems.length > 0) {
      setItems(cachedItems);
      setTotal(cachedTotal);
      return;
    }
    setFetching(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/announcements?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      cachedItems = data.items ?? [];
      cachedTotal = data.total ?? 0;
      cachedPage = p;
      setItems(cachedItems);
      setTotal(cachedTotal);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPage(0);
      fetchPage(0);
    }
  }, [open, fetchPage]);

  const goToPage = (p: number) => {
    setPage(p);
    fetchPage(p);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Megaphone01Icon} className="h-5 w-5 text-primary" />
            All announcements
          </DialogTitle>
        </DialogHeader>

        {fetching ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No announcements yet.
          </p>
        ) : (
          <>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <AnnouncementRow key={item.id} item={item} />
              ))}
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  {total} total &middot; Page {page + 1} of {pageCount}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 0}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= pageCount - 1}
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
      </DialogContent>
    </Dialog>
  );
}
