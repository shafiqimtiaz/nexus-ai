import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { PlatformPill } from "@/components/dashboard/platform-pill";
import type { DashboardEvent } from "@/lib/dashboard";

export function EventDetails({ event }: { event: DashboardEvent }) {
  const end = event.end_time ? new Date(event.end_time) : null;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 px-3 py-3 text-sm">
      {event.description && (
        <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {event.description}
        </p>
      )}
      {end && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Ends: </span>
          {format(end, "EEE, MMM d, yyyy 'at' p")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {event.platform && <PlatformPill platform={event.platform} />}
        {event.is_auto_detected && <Badge variant="secondary">Auto-detected</Badge>}
        {event.source_url && (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            View original announcement
          </a>
        )}
      </div>
    </div>
  );
}
