"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolCallDisplay, type ToolCall } from "./tool-call-display";
import { Markdown } from "./markdown";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCall[];
  model?: string;
};

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Nexus is thinking">
      {["[animation-delay:0ms]", "[animation-delay:150ms]", "[animation-delay:300ms]"].map(
        (delay) => (
          <span
            key={delay}
            className={cn("h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60", delay)}
          />
        )
      )}
    </span>
  );
}

export function ChatMessageBubble({
  message,
  pending,
  onRetry,
}: {
  message: ChatMessage;
  pending: boolean;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  async function copy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-xs">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group/msg flex flex-col items-start gap-1">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-muted/70 px-3.5 py-2 text-sm text-foreground ring-1 ring-foreground/5">
        {message.toolCalls.map((call) => (
          <ToolCallDisplay key={call.toolCallId} call={call} />
        ))}
        {message.content ? <Markdown content={message.content} /> : pending ? <TypingDots /> : null}
      </div>
      {!pending && message.content && (
        <div
          className={cn(
            "flex items-center gap-1 pl-1 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100",
            onRetry && "opacity-100"
          )}
        >
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void copy()}
            className="text-muted-foreground"
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} />
            {copied ? "Copied" : "Copy"}
          </Button>
          {onRetry && (
            <Button variant="ghost" size="xs" onClick={onRetry} className="text-muted-foreground">
              <HugeiconsIcon icon={RefreshIcon} />
              Retry
            </Button>
          )}
          {message.model && (
            <span className="select-none text-[10px] text-muted-foreground/60">
              {message.model}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
