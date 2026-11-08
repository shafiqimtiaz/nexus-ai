"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Wrench01Icon,
  ArrowDown01Icon,
  Loading03Icon,
  Tick02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export type ToolCall = {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state: "running" | "done" | "error";
};

const TOOL_LABELS: Record<string, string> = {
  get_upcoming_events: "Checked your calendar",
  create_event: "Added an event",
  edit_event: "Updated an event",
  cancel_event: "Cancelled an event",
  search_resources: "Searched your resources",
  add_resource: "Saved a resource",
  edit_resource: "Updated a resource",
  generate_study_plan: "Built a study plan",
  set_reminder: "Set a reminder",
  summarize_announcements: "Read your announcements",
  online_search: "Searched the web",
};

function compact(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolCallDisplay({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="my-2 rounded-lg border bg-background/60 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
      >
        <HugeiconsIcon icon={Wrench01Icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{TOOL_LABELS[call.toolName] ?? call.toolName}</span>
        {TOOL_LABELS[call.toolName] && (
          <span className="hidden truncate font-mono text-[10px] text-muted-foreground sm:inline">
            {call.toolName}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {call.state === "running" && (
            <HugeiconsIcon
              icon={Loading03Icon}
              className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            />
          )}
          {call.state === "done" && (
            <HugeiconsIcon icon={Tick02Icon} className="h-3.5 w-3.5 text-green-600" />
          )}
          {call.state === "error" && (
            <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5 text-red-600" />
          )}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t px-3 py-2">
          {call.input !== undefined && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Arguments
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]">
                {compact(call.input)}
              </pre>
            </div>
          )}
          {call.state === "error" ? (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                Error
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-red-600">
                {call.errorText}
              </pre>
            </div>
          ) : (
            call.output !== undefined && (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Result
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]">
                  {compact(call.output)}
                </pre>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
