"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, Loading03Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Label, Resource } from "@/components/resources/resources-view";
import { cn, formatUrl } from "@/lib/utils";

const inputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function ResourceForm({
  open,
  onOpenChange,
  resource,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: Resource | null;
  labels: Label[];
}) {
  const queryClient = useQueryClient();
  const isEdit = resource !== null;

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newLabel, setNewLabel] = useState("");

  // Reset fields whenever the dialog opens for a different resource.
  useEffect(() => {
    if (!open) return;
    if (resource) {
      setTitle(resource.title);
      setUrl(resource.url);
      setDescription(resource.description ?? "");
      setSelected(new Set(resource.labels.map((l) => l.id)));
    } else {
      setTitle("");
      setUrl("");
      setDescription("");
      setSelected(new Set());
    }
    setNewLabel("");
  }, [open, resource]);

  const toggleLabel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createLabel = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create label.");
      return json.label as Label;
    },
    onSuccess: (label) => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      setSelected((prev) => new Set(prev).add(label.id));
      setNewLabel("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        url: formatUrl(url.trim()),
        description: description.trim() || null,
        labelIds: Array.from(selected),
      };
      const res = await fetch("/api/resources", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: resource!.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save resource.");
      return json.resource as Resource;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Resource updated." : "Resource added.");
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const busy = save.isPending;
  const canSave = title.trim() !== "" && url.trim() !== "";

  const submitNewLabel = () => {
    const name = newLabel.trim();
    if (!name || createLabel.isPending) return;
    createLabel.mutate(name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit resource" : "Add resource"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this link and its labels."
              : "Save a link with a title and optional labels."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="resource-title" className="text-xs font-medium">
              Title
            </label>
            <Input
              id="resource-title"
              value={title}
              disabled={busy}
              placeholder="Course syllabus"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="resource-url" className="text-xs font-medium">
              URL
            </label>
            <Input
              id="resource-url"
              type="url"
              value={url}
              disabled={busy}
              placeholder="https://…"
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="resource-description" className="text-xs font-medium">
              Description (optional)
            </label>
            <textarea
              id="resource-description"
              value={description}
              disabled={busy}
              rows={3}
              placeholder="What is this and why keep it…"
              onChange={(e) => setDescription(e.target.value)}
              className={cn(inputClass, "h-auto py-1.5")}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium">Labels</span>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const active = selected.has(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      disabled={busy}
                      onClick={() => toggleLabel(label.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {active && <HugeiconsIcon icon={Tick02Icon} className="h-3 w-3" />}
                      {!active && label.color && (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                      )}
                      {label.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Input
                value={newLabel}
                disabled={busy || createLabel.isPending}
                placeholder="New label…"
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitNewLabel();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || createLabel.isPending || !newLabel.trim()}
                onClick={submitNewLabel}
              >
                {createLabel.isPending ? (
                  <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={PlusSignIcon} className="h-3.5 w-3.5" />
                )}
                Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !canSave} onClick={() => save.mutate()}>
            {save.isPending && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
