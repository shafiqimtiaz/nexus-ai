import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, Link02Icon, RefreshIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardAgentAction } from "@/lib/dashboard";

export function AgentActions({ items, className }: { items: DashboardAgentAction[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={SparklesIcon} className="h-4 w-4 text-amber-500 animate-pulse" />
          Agent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No autonomous actions logged yet. Synced updates will trigger concierge actions.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              let icon = SparklesIcon;
              let iconColor = "text-amber-500";
              if (item.action_type === "calendar") {
                icon = Calendar03Icon;
                iconColor = "text-blue-500";
              } else if (item.action_type === "resource") {
                icon = Link02Icon;
                iconColor = "text-emerald-500";
              } else if (item.action_type === "sync") {
                icon = RefreshIcon;
                iconColor = "text-cyan-500";
              }

              return (
                <li key={item.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <div className={`mt-0.5 rounded-full bg-muted p-1.5 ${iconColor}`}>
                    <HugeiconsIcon icon={icon} className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground block truncate">
                      {item.title}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                      {item.description}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
