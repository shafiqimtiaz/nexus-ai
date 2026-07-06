"use client";

import { useState } from "react";
import { Wrench, ChevronDown, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolCall = {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state: "running" | "done" | "error";
};

function compact(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// A chip/card showing one agent tool invocation: the tool name, its arguments,
// and (once available) a short done/error indicator with the result. This is
// the visible proof that the agent is actually calling tools.
export function ToolCallDisplay({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="my-2 rounded-lg border bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-mono font-medium">{call.toolName}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {call.state === "running" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {call.state === "done" && (
            <Check className="h-3.5 w-3.5 text-green-600" />
          )}
          {call.state === "error" && <X className="h-3.5 w-3.5 text-red-600" />}
          <ChevronDown
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
