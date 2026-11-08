"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { labelTone } from "@/components/resources/label-tone";
import type { Label, Resource } from "@/components/resources/resources-view";
import { cn, formatUrl } from "@/lib/utils";

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

  // Mounted fresh (keyed) each time the dialog opens, so initial state comes straight from props.
  const [title, setTitle] = useState(resource?.title ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(resource?.labels.map((l) => l.id) ?? [])
  );
  const [newLabel, setNewLabel] = useState("");

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
          <DialogTitle>{isEdit ? "Edit resource" : "Add to library"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this link and its labels."
              : "Save a link with a title, a note, and labels so you can find it later."}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="resource-title">Title</FieldLabel>
            <Input
              id="resource-title"
              value={title}
              disabled={busy}
              placeholder="Course syllabus"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="resource-url">URL</FieldLabel>
            <Input
              id="resource-url"
              type="url"
              value={url}
              disabled={busy}
              placeholder="https://…"
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="resource-description">Note (optional)</FieldLabel>
            <Textarea
              id="resource-description"
              value={description}
              disabled={busy}
              rows={3}
              placeholder="What is this and why keep it…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div className="space-y-2">
            <span className="text-xs font-medium text-foreground/80">Labels</span>
            {labels.length > 0 && (
              <ToggleGroup
                multiple
                spacing={1}
                aria-label="Labels"
                className="w-full flex-wrap"
                value={Array.from(selected)}
                disabled={busy}
                onValueChange={(value) => setSelected(new Set(value))}
              >
                {labels.map((label) => (
                  <ToggleGroupItem
                    key={label.id}
                    value={label.id}
                    variant="outline"
                    size="sm"
                    className="rounded-full data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"
                  >
                    <span className={cn("size-2 rounded-full", labelTone(label.color).dot)} />
                    {label.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}

            <div className="flex gap-2 pt-1">
              <Input
                value={newLabel}
                aria-label="New label"
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
                disabled={busy || createLabel.isPending || !newLabel.trim()}
                onClick={submitNewLabel}
              >
                {createLabel.isPending ? <Spinner /> : <HugeiconsIcon icon={PlusSignIcon} />}
                Add
              </Button>
            </div>
          </div>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !canSave} onClick={() => save.mutate()}>
            {save.isPending && <Spinner />}
            {isEdit ? "Save changes" : "Add to library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
