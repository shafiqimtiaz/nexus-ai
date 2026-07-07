"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { SentIcon, Loading03Icon, SparklesIcon, Key01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import { ToolCallDisplay, type ToolCall } from "./tool-call-display";
import { Markdown } from "./markdown";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCall[];
  model?: string;
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m${idCounter}`;
}

// Parse the AI SDK UI message stream (SSE: `data: {json}\n\n`) and drive the
// passed callbacks. We split the byte stream on blank lines, strip the `data: `
// prefix, JSON.parse each event, and dispatch by its `type` field. The exact
// type strings match ai@7's UIMessageChunk union (text-delta, tool-input-*,
// tool-output-*, error).
async function readUiStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onTextDelta: (delta: string) => void;
    onToolStart: (id: string, name: string) => void;
    onToolInput: (id: string, input: unknown) => void;
    onToolOutput: (id: string, output: unknown) => void;
    onToolError: (id: string, errorText: string) => void;
    onError: (errorText: string) => void;
  }
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (raw: string) => {
    // An SSE event block: keep only `data:` payload lines, joined.
    const payload = raw
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!payload || payload === "[DONE]") return;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }

    switch (event.type) {
      case "text-delta":
        handlers.onTextDelta(String(event.delta ?? ""));
        break;
      case "tool-input-start":
        handlers.onToolStart(String(event.toolCallId), String(event.toolName));
        break;
      case "tool-input-available":
        handlers.onToolInput(String(event.toolCallId), event.input);
        break;
      case "tool-output-available":
        handlers.onToolOutput(String(event.toolCallId), event.output);
        break;
      case "tool-input-error":
      case "tool-output-error":
        handlers.onToolError(
          String(event.toolCallId),
          String(event.errorText ?? "Tool call failed")
        );
        break;
      case "error":
        handlers.onError(String(event.errorText ?? "Something went wrong"));
        break;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      dispatch(block);
    }
  }
  if (buffer.trim()) dispatch(buffer);
}

export function ChatInterface({ role }: { role: Role }) {
  const router = useRouter();
  const isDemo = role === "demo";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini-flash-lite-latest");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function checkKey() {
      try {
        const res = await fetch("/api/platforms");
        if (!res.ok) throw new Error();
        const data = await res.json();
        const hasUserKey = data.platforms?.some((p: any) => p.type === "gemini" && p.is_connected);
        setHasKey(!!data.hasGlobalGeminiKey || !!hasUserKey);
      } catch {
        setHasKey(false);
      }
    }
    checkKey();
  }, []);

  // Mutate the last (assistant) message in place via functional update.
  const updateAssistant = (mutate: (m: ChatMessage) => void) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      const last = { ...next[next.length - 1] };
      last.toolCalls = last.toolCalls.slice();
      mutate(last);
      next[next.length - 1] = last;
      return next;
    });
    queueMicrotask(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  };

  const upsertTool = (m: ChatMessage, id: string, patch: Partial<ToolCall>) => {
    const idx = m.toolCalls.findIndex((t) => t.toolCallId === id);
    if (idx === -1) {
      m.toolCalls.push({
        toolCallId: id,
        toolName: patch.toolName ?? "tool",
        state: "running",
        ...patch,
      });
    } else {
      m.toolCalls[idx] = { ...m.toolCalls[idx], ...patch };
    }
  };

  async function send() {
    const text = input.trim();
    if (!text || busy || isDemo) return;

    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: text,
      toolCalls: [],
    };
    const history = [...messages, userMsg];
    setMessages([
      ...history,
      { id: nextId(), role: "assistant", content: "", toolCalls: [], model: selectedModel },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
        }),
      });

      if (!res.ok || !res.body) {
        const msg =
          res.status === 403
            ? "Chat is owner-only. Log in to use the agent."
            : `Request failed (${res.status}).`;
        updateAssistant((m) => {
          m.content = msg;
        });
        return;
      }

      await readUiStream(res.body, {
        onTextDelta: (delta) =>
          updateAssistant((m) => {
            m.content += delta;
          }),
        onToolStart: (id, name) => updateAssistant((m) => upsertTool(m, id, { toolName: name })),
        onToolInput: (id, inputArgs) =>
          updateAssistant((m) => upsertTool(m, id, { input: inputArgs })),
        onToolOutput: (id, output) =>
          updateAssistant((m) => upsertTool(m, id, { output, state: "done" })),
        onToolError: (id, errorText) =>
          updateAssistant((m) => upsertTool(m, id, { errorText, state: "error" })),
        onError: (errorText) =>
          updateAssistant((m) => {
            m.content += `\n\n_Error: ${errorText}_`;
          }),
      });
    } catch {
      updateAssistant((m) => {
        m.content = m.content || "Network error — please try again.";
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {isDemo && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Demo mode — log in to chat with the agent. (See the demo video for the agent in action.)
        </div>
      )}

      {!isDemo && hasKey && (
        <div className="mb-3 flex items-center justify-between gap-4 rounded-lg border bg-card px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              AI Assistant Connected
            </span>
          </div>
        </div>
      )}

      {hasKey === null && (
        <div className="flex-1 flex items-center justify-center">
          <HugeiconsIcon icon={Loading03Icon} className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!hasKey && hasKey !== null && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed rounded-lg bg-card shadow-sm space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <HugeiconsIcon icon={Key01Icon} className="h-6 w-6" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-semibold tracking-tight">Gemini API Key Required</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The AI Chat requires a Gemini API Key to function. Please go to the **Options** page
              to connect Google Gemini, or configure the `GEMINI_API_KEY` environment variable on
              your server.
            </p>
          </div>
          <Button onClick={() => router.push("/options")} className="cursor-pointer">
            Configure API Key
          </Button>
        </div>
      )}

      {hasKey && (
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto rounded-lg border bg-card p-4"
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <HugeiconsIcon icon={SparklesIcon} className="h-8 w-8" />
              <p className="text-sm">
                Ask Nexus about your upcoming exams, plan a study schedule, or summarize recent
                announcements.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  m.role === "user" ? "bg-green-600 text-white" : "bg-muted text-foreground"
                )}
              >
                {m.role === "assistant" &&
                  m.toolCalls.map((call) => <ToolCallDisplay key={call.toolCallId} call={call} />)}
                {m.content ? (
                  m.role === "assistant" ? (
                    <Markdown content={m.content} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )
                ) : m.role === "assistant" && busy ? (
                  <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
                ) : null}
                {m.role === "assistant" && m.model && (
                  <div className="mt-1 text-[9px] text-muted-foreground/60 select-none text-right">
                    {m.model}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {!isDemo && hasKey && (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={busy}
            className="box-border h-10 w-44 shrink-0 cursor-pointer rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-border-dark focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-75"
          >
            <option value="gemini-flash-lite-latest" className="bg-card text-foreground">
              Gemini Lite (Default)
            </option>
            <option value="gemini-flash-latest" className="bg-card text-foreground">
              Gemini Flash
            </option>
            <option value="gemini-pro-latest" className="bg-card text-foreground">
              Gemini Pro
            </option>
            <option value="gemini-3.1-flash-lite" className="bg-card text-foreground">
              Gemini 3.1 Lite
            </option>
            <option value="gemini-3.5-flash" className="bg-card text-foreground">
              Gemini 3.5 Flash
            </option>
          </select>
        )}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isDemo ? "Log in to chat with Nexus" : !hasKey ? "API Key required" : "Message Nexus…"
          }
          disabled={isDemo || busy || !hasKey}
          className="h-10"
        />
        <Button type="submit" disabled={isDemo || busy || !input.trim() || !hasKey}>
          {busy ? (
            <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
          ) : (
            <HugeiconsIcon icon={SentIcon} className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
