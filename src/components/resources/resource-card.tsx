"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ExternalLinkIcon,
  Loading03Icon,
  PencilEdit02Icon,
  PinIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Label, Resource } from "@/components/resources/resources-view";
import { cn, formatUrl } from "@/lib/utils";

function labelStyle(color: string | null) {
  if (!color) return undefined;
  return { backgroundColor: `${color}22`, color };
}

function LabelBadge({ label }: { label: Label }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        !label.color && "bg-muted text-muted-foreground"
      )}
      style={labelStyle(label.color)}
    >
      {label.name}
    </span>
  );
}

function hostname(url: string) {
  try {
    return new URL(formatUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ResourceCard({
  resource,
  canEdit,
  onEdit,
}: {
  resource: Resource;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["resources"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const togglePin = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resource.id, is_pinned: !resource.is_pinned }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not update pin.");
      return json;
    },
    onSuccess: () => {
      toast.success(resource.is_pinned ? "Unpinned." : "Pinned to dashboard.");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/resources?id=${resource.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not delete resource.");
      return json;
    },
    onSuccess: () => {
      toast.success("Resource deleted.");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const busy = togglePin.isPending || remove.isPending;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="grid-cols-[1fr_auto] items-start gap-2">
        <CardTitle className="min-w-0 text-base leading-snug">
          <a
            href={formatUrl(resource.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <span className="line-clamp-2">{resource.title}</span>
            <HugeiconsIcon icon={ExternalLinkIcon} className="h-3.5 w-3.5 shrink-0" />
          </a>
          <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
            {hostname(resource.url)}
          </span>
        </CardTitle>
        {canEdit && (
          <Button
            variant={resource.is_pinned ? "secondary" : "ghost"}
            size="icon-sm"
            disabled={busy}
            aria-label={resource.is_pinned ? "Unpin resource" : "Pin resource"}
            aria-pressed={resource.is_pinned}
            onClick={() => togglePin.mutate()}
          >
            <HugeiconsIcon
              icon={PinIcon}
              className={cn("h-4 w-4", resource.is_pinned && "fill-current")}
            />
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {resource.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{resource.description}</p>
        )}

        {resource.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {resource.labels.map((label) => (
              <LabelBadge key={label.id} label={label} />
            ))}
          </div>
        )}

        {canEdit && (
          <div className="mt-auto flex justify-end gap-1 pt-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label="Edit resource"
              onClick={onEdit}
            >
              <HugeiconsIcon icon={PencilEdit02Icon} className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label="Delete resource"
              onClick={() => {
                if (window.confirm(`Delete "${resource.title}"?`)) remove.mutate();
              }}
            >
              {remove.isPending ? (
                <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
              ) : (
                <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 text-destructive" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
