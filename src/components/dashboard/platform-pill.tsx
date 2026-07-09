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
  google_classroom: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  discord: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  slack: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  gemini: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  google_oauth: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  google_calendar: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const FALLBACK_STYLE = "bg-muted text-muted-foreground";

export function formatPlatform(type: string): string {
  return PLATFORM_LABELS[type] ?? type;
}

export function PlatformPill({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        PLATFORM_STYLES[platform] ?? FALLBACK_STYLE,
        className
      )}
    >
      {formatPlatform(platform)}
    </span>
  );
}
