"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import type { Role } from "@/lib/auth";
import { OPEN_CHAT_EVENT, type OpenChatDetail } from "@/lib/chat-events";
import { useHydrated } from "@/lib/use-hydrated";
import type { ToolCall } from "./tool-call-display";
import { readUiStream } from "./chat-stream";
import { ChatMessageBubble, type ChatMessage } from "./chat-message";
import { ChatComposer, CHAT_MODELS } from "./chat-composer";
import { ChatEmptyState } from "./chat-empty-state";
import { DemoKeyForm, MissingKeyNotice } from "./chat-key-gate";

const DEMO_KEY_STORAGE = "nexus_demo_gemini_key";
const HISTORY_STORAGE = "nexus_chat_history";

function nextId(): string {
  return crypto.randomUUID();
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_STORAGE);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function ChatInterface({
  role,
  expanded = false,
  autoFocus = false,
}: {
  role: Role;
  expanded?: boolean;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const isDemo = role === "demo";
  const hydrated = useHydrated();
  // Browser storage is read lazily; nothing that depends on it renders until `hydrated`.
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    typeof window === "undefined" ? [] : loadHistory()
  );
  const [demoKey, setDemoKey] = useState(() =>
    typeof window === "undefined" ? "" : (localStorage.getItem(DEMO_KEY_STORAGE) ?? "")
  );
  const [ownerHasKey, setOwnerHasKey] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedModel, setSelectedModel] = useState(CHAT_MODELS[0].value);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasKey = !hydrated ? null : isDemo ? demoKey !== "" : ownerHasKey;

  // Persist finished turns so the widget and /chat page share one conversation.
  useEffect(() => {
    if (busy) return;
    sessionStorage.setItem(HISTORY_STORAGE, JSON.stringify(messages));
  }, [messages, busy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (isDemo) return;
    async function checkKey() {
      try {
        const res = await fetch("/api/platforms");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as {
          hasGlobalGeminiKey?: boolean;
          platforms?: { type: string; is_connected: boolean }[];
        };
        const hasUserKey = data.platforms?.some((p) => p.type === "gemini" && p.is_connected);
        setOwnerHasKey(!!data.hasGlobalGeminiKey || !!hasUserKey);
      } catch {
        setOwnerHasKey(false);
      }
    }
    void checkKey();
  }, [isDemo]);

  const saveDemoKey = (raw: string) => {
    const trimmed = raw.trim();
    localStorage.setItem(DEMO_KEY_STORAGE, trimmed);
    setDemoKey(trimmed);
  };

  const clearDemoKey = () => {
    localStorage.removeItem(DEMO_KEY_STORAGE);
    setDemoKey("");
  };

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

  async function ask(text: string, prior: ChatMessage[]) {
    if (!text || busy) return;
    if (isDemo && !demoKey) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text, toolCalls: [] };
    const history = [...prior, userMsg];
    setMessages([
      ...history,
      { id: nextId(), role: "assistant", content: "", toolCalls: [], model: selectedModel },
    ]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let toolsRan = false;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isDemo && demoKey) headers["x-gemini-key"] = demoKey;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
        }),
      });

      if (!res.ok || !res.body) {
        const msg =
          res.status === 403
            ? "Add a Gemini API key to use the agent."
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
        onToolOutput: (id, output) => {
          toolsRan = true;
          updateAssistant((m) => upsertTool(m, id, { output, state: "done" }));
        },
        onToolError: (id, errorText) =>
          updateAssistant((m) => upsertTool(m, id, { errorText, state: "error" })),
        onError: (errorText) =>
          updateAssistant((m) => {
            m.content += `\n\n_Error: ${errorText}_`;
          }),
      });
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      updateAssistant((m) => {
        if (aborted) m.content = m.content ? `${m.content}\n\n_Stopped._` : "_Stopped._";
        else m.content = m.content || "Network error — please try again.";
        m.toolCalls = m.toolCalls.map((t) =>
          t.state === "running" ? { ...t, state: "error", errorText: "Cancelled" } : t
        );
      });
    } finally {
      abortRef.current = null;
      setBusy(false);
      // Tools may have created or edited events/resources — refresh server-rendered pages.
      if (toolsRan) router.refresh();
    }
  }

  const send = () => void ask(input.trim(), messages);

  const retry = () => {
    const lastUser = messages.findLastIndex((m) => m.role === "user");
    if (lastUser === -1) return;
    void ask(messages[lastUser].content, messages.slice(0, lastUser));
  };

  const askRef = useRef(ask);
  const messagesRef = useRef(messages);
  useEffect(() => {
    askRef.current = ask;
    messagesRef.current = messages;
  });

  useEffect(() => {
    const onOpen = (e: Event) => {
      const prompt = (e as CustomEvent<OpenChatDetail>).detail?.prompt;
      if (prompt) void askRef.current(prompt, messagesRef.current);
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, []);

  const clear = () => {
    abortRef.current?.abort();
    setMessages([]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {hasKey && (messages.length > 0 || isDemo) && (
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          {isDemo && hasKey ? (
            <span className="truncate text-amber-700 dark:text-amber-400">
              Demo · using your Gemini key ·{" "}
              <button
                type="button"
                onClick={clearDemoKey}
                className="cursor-pointer font-semibold underline underline-offset-2 hover:opacity-80"
              >
                Change key
              </button>
            </span>
          ) : (
            <span />
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <HugeiconsIcon icon={Delete02Icon} className="h-3.5 w-3.5" />
              New chat
            </button>
          )}
        </div>
      )}

      {hasKey === null && (
        <div className="flex flex-1 items-center justify-center">
          <HugeiconsIcon
            icon={Loading03Icon}
            className="h-8 w-8 animate-spin text-muted-foreground"
          />
        </div>
      )}

      {hasKey === false && (isDemo ? <DemoKeyForm onSave={saveDemoKey} /> : <MissingKeyNotice />)}

      {hasKey && (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-xl border bg-card p-4"
        >
          {messages.length === 0 ? (
            <ChatEmptyState compact={!expanded} onPick={(p) => void ask(p, messages)} />
          ) : (
            messages.map((m, i) => (
              <ChatMessageBubble
                key={m.id}
                message={m}
                pending={busy && i === messages.length - 1}
                onRetry={
                  !busy && i === messages.length - 1 && m.role === "assistant" ? retry : undefined
                }
              />
            ))
          )}
        </div>
      )}

      <ChatComposer
        value={input}
        onChange={setInput}
        onSubmit={send}
        onStop={() => abortRef.current?.abort()}
        busy={busy}
        disabled={!hasKey}
        placeholder={
          !hasKey ? (isDemo ? "Add a Gemini key to chat" : "API key required") : "Ask Nexus…"
        }
        model={selectedModel}
        onModelChange={setSelectedModel}
        autoFocus={autoFocus}
      />
    </div>
  );
}
