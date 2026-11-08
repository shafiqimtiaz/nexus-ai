"use client";

import Image from "next/image";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Calendar03Icon,
  Notification03Icon,
  BookOpen01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const SUGGESTIONS: { icon: IconSvgElement; label: string; prompt: string }[] = [
  {
    icon: Calendar03Icon,
    label: "What's coming up this week?",
    prompt: "What exams, quizzes, and deadlines do I have in the next 7 days?",
  },
  {
    icon: Clock01Icon,
    label: "Plan study time for my next exam",
    prompt:
      "Create a study plan for my next exam with a few study blocks spread over the days before it.",
  },
  {
    icon: Notification03Icon,
    label: "Summarize recent announcements",
    prompt: "Summarize my recent announcements and highlight anything with a deadline.",
  },
  {
    icon: BookOpen01Icon,
    label: "Find resources for my next quiz",
    prompt: "Which saved resources would help me prepare for my next quiz?",
  },
];

export function ChatEmptyState({
  compact,
  onPick,
}: {
  compact: boolean;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 py-6 text-center">
      <div className="space-y-2">
        <Image src="/nexus-icon.png" alt="" width={44} height={44} className="mx-auto h-11 w-11" />
        <h3 className="text-base font-semibold tracking-tight">How can I help?</h3>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">
          I can check your schedule, plan study sessions, summarize announcements, and manage your
          resources.
        </p>
      </div>
      <div className={cn("grid w-full max-w-xl gap-2", !compact && "sm:grid-cols-2")}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5 text-left text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <HugeiconsIcon icon={s.icon} className="h-4 w-4 shrink-0 text-primary" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
