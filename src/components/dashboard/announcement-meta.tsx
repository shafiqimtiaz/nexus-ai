import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { PlatformPill } from "@/components/dashboard/platform-pill";
import type { DashboardAnnouncement } from "@/lib/dashboard";

export function AnnouncementMeta({ item }: { item: DashboardAnnouncement }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.author && (
        <Badge className="bg-primary/10 text-primary dark:bg-primary/15">{item.author}</Badge>
      )}
      {item.announced_at && (
        <Badge variant="secondary" suppressHydrationWarning>
          {formatDistanceToNow(new Date(item.announced_at), { addSuffix: true })}
        </Badge>
      )}
      {item.channel && <Badge variant="secondary">{item.channel}</Badge>}
      {item.platform && <PlatformPill platform={item.platform} />}
    </div>
  );
}
