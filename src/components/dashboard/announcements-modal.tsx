"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Megaphone01Icon, ArrowDown01Icon, ExternalLinkIcon } from "@hugeicons/core-free-icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DashboardAnnouncement } from "@/lib/dashboard";

const PAGE_SIZE = 5; 
const HIGHLIGHT_DURATION = 2000;

const PILL_BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

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

function AnnouncementRow({ item, highlighted }: { item: DashboardAnnouncement; highlighted?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-announcement-id={item.id}
      className={cn(
        "rounded-lg border transition-colors",
        highlighted && "ring-2 ring-primary ring-offset-2"
      )}
    >
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
              <span className="truncate text-sm font-medium">{item.title || "Announcement"}</span>
            </div>
            {item.ai_summary && (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.ai_summary}</p>
            )}
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

      {expanded && (
        <div className="border-t px-4 py-3 text-sm">
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <HugeiconsIcon icon={ExternalLinkIcon} className="h-3 w-3" />
              Open in source
            </a>
          )}
          {item.content && (
            <p className="leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {item.content}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

type AnnouncementsApiResponse = {
  items?: DashboardAnnouncement[];
  total?: number;
};

let cachedTotal = 0;
let cachedPage = -1; // highest page loaded, -1 = nothing loaded yet
let cachedItems: DashboardAnnouncement[] = [];

export function AnnouncementsModal({
  open,
  onOpenChange,
  initialScrollToId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScrollToId?: string | null;
}) {
  const [items, setItems] = useState<DashboardAnnouncement[]>(cachedItems);
  const [total, setTotal] = useState(cachedTotal);
  const [loading, setLoading] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hasMore = items.length < total;

  const fetchNextPage = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const nextPage = cachedPage + 1;
    const isInitial = cachedPage === -1;
    if (isInitial) setLoading(true);
    else setFetchingMore(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/announcements?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: AnnouncementsApiResponse = await res.json();
      const fetched = data.items ?? [];
      const existingIds = new Set(cachedItems.map((item) => item.id));
      cachedItems = [...cachedItems, ...fetched.filter((item) => !existingIds.has(item.id))];
      cachedTotal = data.total ?? 0;
      cachedPage = nextPage;
      setItems(cachedItems);
      setTotal(cachedTotal);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setFetchingMore(false);
    }
  }, []);

  useEffect(() => {
    if (open && cachedPage === -1) {
      fetchNextPage();
    }
  }, [open, fetchNextPage]);

  useEffect(() => {
    if (!open || !hasMore) return;
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { root }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, hasMore, fetchNextPage]);

  useEffect(() => {
    if (!open || !initialScrollToId || items.length === 0) return;
    const el = scrollContainerRef.current?.querySelector(`[data-announcement-id="${initialScrollToId}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightedId(initialScrollToId);
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), HIGHLIGHT_DURATION);
  }, [open, initialScrollToId, items]);

  useEffect(() => {
    return () => clearTimeout(highlightTimerRef.current);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl !duration-0 data-open:animate-none data-closed:animate-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Megaphone01Icon} className="h-5 w-5 text-primary" />
            All announcements
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          <div
            ref={scrollContainerRef}
            className="max-h-[70vh] space-y-2 overflow-y-auto scrollbar-none pr-1"
          >
            {items.map((item) => (
              <AnnouncementRow key={item.id} item={item} highlighted={item.id === highlightedId} />
            ))}
            {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
            {fetchingMore && (
              <div className="py-3 text-center">
                <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
