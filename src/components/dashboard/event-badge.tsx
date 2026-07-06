import { Badge } from "@/components/ui/badge";
import type { EventType } from "@/lib/dashboard";

const META: Record<EventType, { label: string; className: string }> = {
  exam: {
    label: "Exam",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  },
  quiz: {
    label: "Quiz",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  assignment: {
    label: "Assignment",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  study_block: {
    label: "Study",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  },
  other: {
    label: "Event",
    className: "bg-muted text-muted-foreground",
  },
};

export function EventBadge({ type }: { type: EventType }) {
  const meta = META[type] ?? META.other;
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
