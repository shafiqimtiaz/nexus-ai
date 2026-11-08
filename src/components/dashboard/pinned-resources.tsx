import { HugeiconsIcon } from "@hugeicons/react";
import { PinIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import type { DashboardResource } from "@/lib/dashboard";
import { formatUrl } from "@/lib/utils";

export function PinnedResources({ resources }: { resources: DashboardResource[] }) {
  return (
    <DashboardCard icon={PinIcon} title="Pinned">
      {resources.length === 0 ? (
        <Empty className="p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={PinIcon} />
            </EmptyMedia>
            <EmptyTitle className="text-base">Nothing pinned</EmptyTitle>
            <EmptyDescription>Pin a link in your library to keep it close.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {resources.map((resource) => (
            <li key={resource.id}>
              <Button
                variant="ghost"
                nativeButton={false}
                render={
                  <a href={formatUrl(resource.url)} target="_blank" rel="noopener noreferrer" />
                }
                className="h-auto w-full flex-col items-start gap-0 px-2 py-2 text-left whitespace-normal"
              >
                <span className="w-full truncate text-sm font-medium text-primary">
                  {resource.title}
                </span>
                {resource.description && (
                  <span className="w-full truncate text-xs font-normal text-muted-foreground">
                    {resource.description}
                  </span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
