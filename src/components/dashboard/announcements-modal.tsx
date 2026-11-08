"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Megaphone01Icon, ArrowDown01Icon, ExternalLinkIcon } from "@hugeicons/core-free-icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AnnouncementMeta } from "@/components/dashboard/announcement-meta";
import { cn } from "@/lib/utils";
import type { DashboardAnnouncement } from "@/lib/dashboard";

const PAGE_SIZE = 5;
const HIGHLIGHT_DURATION = 2000;

function AnnouncementRow({
  item,
  highlighted,
}: {
  item: DashboardAnnouncement;
  highlighted?: boolean;
}) {
  return (
    <Collapsible
      data-announcement-id={item.id}
      className={cn(
        "rounded-lg border bg-card transition-all duration-300",
        highlighted && "ring-2 ring-primary"
      )}
    >
      <CollapsibleTrigger className="group/trigger flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50">
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open/trigger:rotate-180"
        />
        <div className="min-w-0 space-y-1">
          <span className="block truncate text-sm font-medium">{item.title || "Announcement"}</span>
          {item.ai_summary && <p className="text-xs text-muted-foreground">{item.ai_summary}</p>}
          <AnnouncementMeta item={item} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 py-3 text-sm">
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <HugeiconsIcon icon={ExternalLinkIcon} className="size-3" />
              Open in source
            </a>
          )}
          {item.content && (
            <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {item.content}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
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
    if (open) {
      cachedPage = -1;
      cachedItems = [];
      cachedTotal = 0;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      fetchNextPage();
    } else {
      isFetchingRef.current = false;
      cachedPage = -1;
      cachedItems = [];
      cachedTotal = 0;
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
    const el = scrollContainerRef.current?.querySelector(
      `[data-announcement-id="${initialScrollToId}"]`
    );
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
            <HugeiconsIcon icon={Megaphone01Icon} className="size-5 text-primary" />
            All announcements
          </DialogTitle>
          <DialogDescription>
            Everything your connected platforms have posted, newest first.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-5 text-primary" />
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
              <div className="flex justify-center py-3">
                <Spinner className="size-5 text-primary" />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
