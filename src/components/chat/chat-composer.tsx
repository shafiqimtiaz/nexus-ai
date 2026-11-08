"use client";

import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export const CHAT_MODELS = [
  { value: "gemini-flash-lite-latest", label: "Gemini Lite" },
  { value: "gemini-flash-latest", label: "Gemini Flash" },
];

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  disabled,
  placeholder,
  model,
  onModelChange,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  placeholder: string;
  model: string;
  onModelChange: (model: string) => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  return (
    <form
      className={cn(
        "mt-3 rounded-xl border bg-card p-2 shadow-xs transition-colors focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-primary/10",
        disabled && "opacity-60"
      )}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Message Nexus"
        className="block field-sizing-content max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={busy || disabled}
          aria-label="Model"
          className="h-7 cursor-pointer rounded-md bg-transparent px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none disabled:cursor-not-allowed"
        >
          {CHAT_MODELS.map((m) => (
            <option key={m.value} value={m.value} className="bg-card text-foreground">
              {m.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] text-muted-foreground/70 sm:inline">
            Shift + Enter for a new line
          </span>
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-80"
            >
              <HugeiconsIcon icon={StopIcon} className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              aria-label="Send message"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <HugeiconsIcon icon={ArrowUp02Icon} className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
