"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Wrench01Icon,
  ArrowDown01Icon,
  Tick02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";

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

function ToolSection({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "error";
  children: string;
}) {
  return (
    <div>
      <div
        className={cn(
          "mb-1 text-[10px] font-semibold tracking-wide uppercase",
          tone === "error" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {label}
      </div>
      <pre
        className={cn(
          "overflow-x-auto font-mono text-[11px] break-words whitespace-pre-wrap",
          tone === "error" && "text-destructive"
        )}
      >
        {children}
      </pre>
    </div>
  );
}

export function ToolCallDisplay({ call }: { call: ToolCall }) {
  return (
    <Collapsible className="my-2 rounded-lg border bg-background/70 text-xs">
      <CollapsibleTrigger className="group/trigger flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <HugeiconsIcon icon={Wrench01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{TOOL_LABELS[call.toolName] ?? call.toolName}</span>
        {TOOL_LABELS[call.toolName] && (
          <span className="hidden truncate font-mono text-[10px] text-muted-foreground sm:inline">
            {call.toolName}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {call.state === "running" && <Spinner className="size-3.5 text-muted-foreground" />}
          {call.state === "done" && (
            <HugeiconsIcon
              icon={Tick02Icon}
              className="size-3.5 text-emerald-600 dark:text-emerald-400"
            />
          )}
          {call.state === "error" && (
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5 text-destructive" />
          )}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className="size-3.5 text-muted-foreground transition-transform group-data-panel-open/trigger:rotate-180"
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 border-t px-3 py-2">
          {call.input !== undefined && (
            <ToolSection label="Arguments">{compact(call.input)}</ToolSection>
          )}
          {call.state === "error" ? (
            <ToolSection label="Error" tone="error">
              {call.errorText ?? ""}
            </ToolSection>
          ) : (
            call.output !== undefined && (
              <ToolSection label="Result">{compact(call.output)}</ToolSection>
            )
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
