import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Megaphone } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardAnnouncement } from "@/lib/dashboard";

export function RecentAnnouncements({
  items,
}: {
  items: DashboardAnnouncement[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          Recent announcements
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No announcements yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const body = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">
                      {item.title || "Announcement"}
                    </span>
                    {item.source_url && (
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  {item.content && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {item.content}
                    </p>
                  )}
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {item.author ? `${item.author} · ` : ""}
                    {item.announced_at
                      ? formatDistanceToNow(new Date(item.announced_at), {
                          addSuffix: true,
                        })
                      : ""}
                  </div>
                </>
              );

              return (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-md transition-colors hover:bg-muted/60"
                    >
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
