import { Bell, CalendarClock, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardData } from "@/lib/dashboard";

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Bell;
  value: string;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickStats({ stats }: { stats: DashboardData["stats"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat
        icon={CalendarClock}
        value={
          stats.daysToNextExam === null
            ? "—"
            : stats.daysToNextExam === 0
              ? "Today"
              : String(stats.daysToNextExam)
        }
        label={
          stats.daysToNextExam === null || stats.daysToNextExam === 0
            ? "Next exam"
            : stats.daysToNextExam === 1
              ? "Day to next exam"
              : "Days to next exam"
        }
      />
      <Stat
        icon={Bell}
        value={String(stats.unreadAnnouncements)}
        label="Unread announcements"
      />
      <Stat
        icon={ClipboardList}
        value={String(stats.upcomingAssignments)}
        label="Upcoming assignments"
      />
    </div>
  );
}
