"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ExternalLinkIcon,
  PencilEdit02Icon,
  PinIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { labelTone } from "@/components/resources/label-tone";
import type { Label, Resource } from "@/components/resources/resources-view";
import { cn, formatUrl } from "@/lib/utils";

function LabelBadge({ label }: { label: Label }) {
  return <Badge className={cn("font-medium", labelTone(label.color).chip)}>{label.name}</Badge>;
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
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
          <Toggle
            size="sm"
            pressed={resource.is_pinned}
            disabled={busy}
            aria-label={resource.is_pinned ? "Unpin resource" : "Pin resource"}
            onPressedChange={() => togglePin.mutate()}
            className="size-8 data-pressed:bg-highlight/20 data-pressed:text-amber-700 dark:data-pressed:text-amber-300"
          >
            <HugeiconsIcon icon={PinIcon} className={cn(resource.is_pinned && "fill-current")} />
          </Toggle>
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
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label="Delete resource"
                  />
                }
              >
                {remove.isPending ? (
                  <Spinner />
                ) : (
                  <HugeiconsIcon icon={Delete02Icon} className="text-destructive" />
                )}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this resource?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &ldquo;{resource.title}&rdquo; will be removed from your library and from the
                    dashboard if it is pinned. This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      setConfirmOpen(false);
                      remove.mutate();
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
