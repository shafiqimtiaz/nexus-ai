"use client";

import { useState } from "react";
import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_META } from "@/components/dashboard/event-badge";
import type { EventType } from "@/lib/dashboard";
import type { CalendarEvent } from "@/components/calendar/calendar-view";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: "exam", label: "Exam" },
  { value: "quiz", label: "Quiz" },
  { value: "assignment", label: "Assignment" },
  { value: "study_block", label: "Study block" },
  { value: "other", label: "Other" },
];

const INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm";

function isoToInput(iso: string | null): string {
  if (!iso) return "";
  return format(new Date(iso), INPUT_FORMAT);
}

function inputToIso(value: string): string {
  return new Date(value).toISOString();
}

function defaultStart(date: Date): string {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return format(d, INPUT_FORMAT);
}

export function EventForm({
  open,
  onOpenChange,
  event,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  defaultDate?: Date;
}) {
  const queryClient = useQueryClient();
  const isEdit = event !== null;

  // Mounted fresh (keyed) each time the dialog opens, so initial state comes straight from props.
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventType, setEventType] = useState<EventType>(event?.event_type ?? "assignment");
  const [start, setStart] = useState(() =>
    event ? isoToInput(event.start_time) : defaultDate ? defaultStart(defaultDate) : ""
  );
  const [end, setEnd] = useState(() => (event ? isoToInput(event.end_time) : ""));
  const [description, setDescription] = useState(event?.description ?? "");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["events"] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        event_type: eventType,
        start_time: inputToIso(start),
        end_time: end ? inputToIso(end) : null,
        description: description.trim() || null,
      };
      const res = await fetch("/api/events", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: event!.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save event.");
      return json.event as CalendarEvent;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Event updated." : "Event created.");
      invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events?id=${event!.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not delete event.");
      return json;
    },
    onSuccess: () => {
      toast.success("Event deleted.");
      invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const busy = save.isPending || remove.isPending;
  const canSave = title.trim() !== "" && start !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit event" : "Add event"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details for this event."
              : "Add an exam, assignment, study block, or other event."}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="event-title">Title</FieldLabel>
            <Input
              id="event-title"
              value={title}
              disabled={busy}
              placeholder="Midterm exam"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select
              items={TYPE_OPTIONS}
              value={eventType}
              disabled={busy}
              onValueChange={(v) => v && setEventType(v as EventType)}
            >
              <SelectTrigger id="event-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className={cn("size-2 rounded-full", EVENT_META[o.value].dot)} />
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="event-start">Starts</FieldLabel>
              <Input
                id="event-start"
                type="datetime-local"
                value={start}
                disabled={busy}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="event-end">Ends (optional)</FieldLabel>
              <Input
                id="event-end"
                type="datetime-local"
                value={end}
                disabled={busy}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="event-description">Notes (optional)</FieldLabel>
            <Textarea
              id="event-description"
              value={description}
              disabled={busy}
              rows={3}
              placeholder="Location, chapters to review, what to bring…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </FieldGroup>

        <DialogFooter className="sm:justify-between">
          {isEdit ? (
            <Button variant="destructive" disabled={busy} onClick={() => remove.mutate()}>
              {remove.isPending ? <Spinner /> : <HugeiconsIcon icon={Delete02Icon} />}
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !canSave} onClick={() => save.mutate()}>
              {save.isPending && <Spinner />}
              {isEdit ? "Save changes" : "Add to calendar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
