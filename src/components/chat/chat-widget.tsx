"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowExpand01Icon,
  ArrowShrink01Icon,
  Cancel01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import { OPEN_CHAT_EVENT } from "@/lib/chat-events";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Brand } from "@/components/layout/brand";
import { ChatInterface } from "./chat-interface";

function IconAction({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} {...props} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ChatWidget({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hidden = pathname?.startsWith("/login") || pathname?.startsWith("/chat");

  useEffect(() => {
    if (hidden) return;
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [hidden]);

  if (hidden) return null;

  return (
    <>
      {!open && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={() => setOpen(true)}
                aria-label="Open AI chat"
                variant="outline"
                size="icon"
                className="fixed right-5 bottom-5 z-40 size-14 rounded-full bg-card p-0 shadow-lg transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
              />
            }
          >
            <Image
              src="/nexus-icon.png"
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 object-contain"
              priority
            />
          </TooltipTrigger>
          <TooltipContent side="left">
            Ask Nexus <Kbd className="bg-background/20 text-background">⌘K</Kbd>
          </TooltipContent>
        </Tooltip>
      )}

      {open && expanded && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={cn(
          "fixed z-50 flex flex-col rounded-2xl border bg-background shadow-2xl ring-1 ring-foreground/5",
          !open && "hidden",
          expanded
            ? "inset-3 sm:inset-6 md:inset-10"
            : "right-3 bottom-3 h-[600px] max-h-[calc(100dvh-1.5rem)] w-96 max-w-[calc(100vw-1.5rem)] sm:right-6 sm:bottom-6"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <Brand />
          <div className="flex items-center gap-0.5">
            <IconAction
              label="Customize AI rules"
              render={<Link href="/options" />}
              nativeButton={false}
            >
              <HugeiconsIcon icon={Settings01Icon} />
            </IconAction>
            <IconAction
              label={expanded ? "Minimize chat" : "Expand chat"}
              onClick={() => setExpanded((e) => !e)}
            >
              <HugeiconsIcon icon={expanded ? ArrowShrink01Icon : ArrowExpand01Icon} />
            </IconAction>
            <IconAction label="Close chat" onClick={() => setOpen(false)}>
              <HugeiconsIcon icon={Cancel01Icon} />
            </IconAction>
          </div>
        </div>

        <div className="min-h-0 flex-1 p-4">
          <ChatInterface role={role} expanded={expanded} autoFocus={open} />
        </div>
      </div>
    </>
  );
}
