import { formatDistanceToNow } from "date-fns";
import { Calendar, Link, RefreshCw, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardAgentAction } from "@/lib/dashboard";

export function AgentActions({ items }: { items: DashboardAgentAction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
          Autonomous Concierge Log
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
              let Icon = Sparkles;
              let iconColor = "text-amber-500";
              if (item.action_type === "calendar") {
                Icon = Calendar;
                iconColor = "text-blue-500";
              } else if (item.action_type === "resource") {
                Icon = Link;
                iconColor = "text-emerald-500";
              } else if (item.action_type === "sync") {
                Icon = RefreshCw;
                iconColor = "text-cyan-500";
              }

              return (
                <li key={item.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <div className={`mt-0.5 rounded-full bg-muted p-1.5 ${iconColor}`}>
                    <Icon className="h-3.5 w-3.5" />
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
