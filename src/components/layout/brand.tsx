import { HugeiconsIcon } from "@hugeicons/react";
import { Mortarboard02Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

export function Brand({
  className,
  showWordmark = true,
  onDark = false,
}: {
  className?: string;
  showWordmark?: boolean;
  onDark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        role={showWordmark ? undefined : "img"}
        aria-label={showWordmark ? undefined : "Nexus"}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-highlight text-sidebar-primary-foreground shadow-sm ring-1 ring-black/10"
      >
        <HugeiconsIcon icon={Mortarboard02Icon} className="size-[18px]" />
      </span>
      {showWordmark && (
        <span className="flex items-baseline gap-1 overflow-hidden whitespace-nowrap">
          <span className="font-heading text-xl font-semibold tracking-tight">Nexus</span>
          <span
            className={cn(
              "text-[10px] font-semibold tracking-[0.18em] uppercase",
              onDark ? "text-highlight" : "text-primary"
            )}
          >
            ai
          </span>
        </span>
      )}
    </span>
  );
}
