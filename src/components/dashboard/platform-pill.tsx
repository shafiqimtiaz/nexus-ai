import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<string, string> = {
  google_classroom: "Google Classroom",
  discord: "Discord",
  slack: "Slack",
  gemini: "Gemini",
  google_oauth: "Google Calendar",
  google_calendar: "Google Calendar",
};

const PLATFORM_STYLES: Record<string, string> = {
  google_classroom: "bg-blue-500/12 text-blue-700 dark:text-blue-300",
  discord: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
  slack: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  gemini: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  google_oauth: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  google_calendar: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
};

const FALLBACK_STYLE = "bg-muted text-muted-foreground";

export function formatPlatform(type: string): string {
  return PLATFORM_LABELS[type] ?? type;
}

export function PlatformPill({ platform, className }: { platform: string; className?: string }) {
  return (
    <Badge className={cn(PLATFORM_STYLES[platform] ?? FALLBACK_STYLE, className)}>
      {formatPlatform(platform)}
    </Badge>
  );
}
