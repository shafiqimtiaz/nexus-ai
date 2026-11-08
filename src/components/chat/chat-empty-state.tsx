"use client";

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AiMagicIcon,
  Calendar03Icon,
  Notification03Icon,
  BookOpen01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

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
    <Empty className="h-full gap-5 border-0 py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={AiMagicIcon} />
        </EmptyMedia>
        <EmptyTitle className="text-xl">What are we studying today?</EmptyTitle>
        <EmptyDescription>
          I can check your schedule, plan study sessions, summarize announcements, and manage your
          library.
        </EmptyDescription>
      </EmptyHeader>
      <div className={cn("grid w-full max-w-xl gap-2", !compact && "sm:grid-cols-2")}>
        {SUGGESTIONS.map((s) => (
          <Button
            key={s.label}
            variant="outline"
            onClick={() => onPick(s.prompt)}
            className="h-auto justify-start gap-2.5 bg-background px-3 py-2.5 text-left text-xs whitespace-normal hover:border-primary/40 hover:bg-accent"
          >
            <HugeiconsIcon icon={s.icon} className="text-primary" />
            {s.label}
          </Button>
        ))}
      </div>
    </Empty>
  );
}
