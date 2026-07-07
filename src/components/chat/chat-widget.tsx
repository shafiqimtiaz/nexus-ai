"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowExpand01Icon, ArrowShrink01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import { ChatInterface } from "./chat-interface";

export function ChatWidget({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (pathname?.startsWith("/login")) return null;

  return (
    <>
      {/* Bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI chat"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-lg ring-1 ring-border transition-transform hover:scale-105 cursor-pointer"
        >
          <Image src="/nexus-icon.png" alt="Nexus" width={36} height={36} className="h-9 w-9" priority />
        </button>
      )}

      {/* Backdrop for expanded mode */}
      {open && expanded && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 flex flex-col rounded-xl border bg-background shadow-2xl",
            expanded
              ? "inset-4 sm:inset-6 md:inset-10"
              : "bottom-6 right-6 h-[600px] max-h-[calc(100vh-3rem)] w-96 max-w-[calc(100vw-3rem)]"
          )}
        >
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <Image src="/nexus-icon.png" alt="Nexus" width={24} height={24} className="h-6 w-6" />
              <span className="text-sm font-semibold tracking-tight">Nexus AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded((e) => !e)}
                aria-label={expanded ? "Minimize chat" : "Expand chat"}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <HugeiconsIcon
                  icon={expanded ? ArrowShrink01Icon : ArrowExpand01Icon}
                  className="h-4 w-4"
                />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 p-4">
            <ChatInterface role={role} expanded={expanded} />
          </div>
        </div>
      )}
    </>
  );
}
