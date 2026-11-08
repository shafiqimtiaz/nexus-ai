import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EventType } from "@/lib/dashboard";

export const EVENT_META: Record<EventType, { label: string; className: string; dot: string }> = {
  exam: {
    label: "Exam",
    className: "bg-red-500/12 text-red-700 dark:bg-red-400/15 dark:text-red-300",
    dot: "bg-red-500",
  },
  quiz: {
    label: "Quiz",
    className: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  assignment: {
    label: "Assignment",
    className: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  study_block: {
    label: "Study",
    className: "bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  other: {
    label: "Event",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
};

export function EventBadge({ type, className }: { type: EventType; className?: string }) {
  const meta = EVENT_META[type] ?? EVENT_META.other;
  return <Badge className={cn(meta.className, className)}>{meta.label}</Badge>;
}
