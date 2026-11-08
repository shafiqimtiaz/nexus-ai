"use client";

import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";

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
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <InputGroup className={cn("bg-card", disabled && "opacity-60")}>
        <InputGroupTextarea
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
          className="max-h-40 min-h-10"
        />
        <InputGroupAddon align="block-end" className="justify-between">
          <Select
            items={CHAT_MODELS}
            value={model}
            onValueChange={(v) => v && onModelChange(v)}
            disabled={busy || disabled}
          >
            <SelectTrigger
              size="sm"
              aria-label="Model"
              className="h-7 border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-transparent"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" side="top" className="min-w-40">
              {CHAT_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 text-[11px] text-muted-foreground/80 sm:flex">
              <Kbd>Shift</Kbd>
              <Kbd>Enter</Kbd>
              new line
            </span>
            {busy ? (
              <InputGroupButton
                variant="default"
                size="icon-sm"
                onClick={onStop}
                aria-label="Stop generating"
                className="rounded-full bg-foreground text-background hover:bg-foreground/80"
              >
                <HugeiconsIcon icon={StopIcon} />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                variant="default"
                size="icon-sm"
                disabled={disabled || !value.trim()}
                aria-label="Send message"
                className="rounded-full"
              >
                <HugeiconsIcon icon={ArrowUp02Icon} />
              </InputGroupButton>
            )}
          </div>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
