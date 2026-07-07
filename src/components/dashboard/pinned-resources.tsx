import { HugeiconsIcon } from "@hugeicons/react";
import { PinIcon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardResource } from "@/lib/dashboard";
import { formatUrl } from "@/lib/utils";

export function PinnedResources({ resources }: { resources: DashboardResource[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={PinIcon} className="h-4 w-4 text-primary" />
          Pinned resources
        </CardTitle>
      </CardHeader>
      <CardContent>
        {resources.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing pinned yet.</p>
        ) : (
          <ul className="space-y-2">
            {resources.map((resource) => (
              <li key={resource.id}>
                <a
                  href={formatUrl(resource.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
                >
                  <div className="truncate text-sm font-medium text-primary">{resource.title}</div>
                  {resource.description && (
                    <p className="truncate text-xs text-muted-foreground">{resource.description}</p>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
