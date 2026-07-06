"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
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

// datetime-local <-> ISO. The input holds local wall-clock time with no zone;
// new Date(localString) parses it as local, and toISOString() gives UTC.
const INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm";

function isoToInput(iso: string | null): string {
  if (!iso) return "";
  return format(new Date(iso), INPUT_FORMAT);
}

function inputToIso(value: string): string {
  return new Date(value).toISOString();
}

// Default a create form to the clicked day at 09:00 local.
function defaultStart(date: Date): string {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return format(d, INPUT_FORMAT);
}

const inputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("assignment");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [description, setDescription] = useState("");

  // Reset fields whenever the dialog opens for a different event/date.
  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setEventType(event.event_type);
      setStart(isoToInput(event.start_time));
      setEnd(isoToInput(event.end_time));
      setDescription(event.description ?? "");
    } else {
      setTitle("");
      setEventType("assignment");
      setStart(defaultDate ? defaultStart(defaultDate) : "");
      setEnd("");
      setDescription("");
    }
  }, [open, event, defaultDate]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["events"] });

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
          <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details for this event."
              : "Add an exam, assignment, study block, or other event."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="event-title" className="text-xs font-medium">
              Title
            </label>
            <Input
              id="event-title"
              value={title}
              disabled={busy}
              placeholder="Midterm exam"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="event-type" className="text-xs font-medium">
              Type
            </label>
            <select
              id="event-type"
              value={eventType}
              disabled={busy}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className={inputClass}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="event-start" className="text-xs font-medium">
                Starts
              </label>
              <Input
                id="event-start"
                type="datetime-local"
                value={start}
                disabled={busy}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="event-end" className="text-xs font-medium">
                Ends (optional)
              </label>
              <Input
                id="event-end"
                type="datetime-local"
                value={end}
                disabled={busy}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="event-description" className="text-xs font-medium">
              Description (optional)
            </label>
            <textarea
              id="event-description"
              value={description}
              disabled={busy}
              rows={3}
              placeholder="Notes, location, chapters to review…"
              onChange={(e) => setDescription(e.target.value)}
              className={cn(inputClass, "h-auto py-1.5")}
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {isEdit ? (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button disabled={busy || !canSave} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
