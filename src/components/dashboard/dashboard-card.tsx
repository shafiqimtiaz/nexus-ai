import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardCard({
  icon,
  title,
  action,
  className,
  contentClassName,
  children,
}: {
  icon: IconSvgElement;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon icon={icon} className="size-4" />
          </span>
          {title}
        </CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn("flex flex-1 flex-col", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
