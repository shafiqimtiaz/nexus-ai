import Image from "next/image";

import { cn } from "@/lib/utils";

export function Brand({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Image
        src="/nexus-icon.png"
        alt={showWordmark ? "" : "Nexus"}
        width={32}
        height={32}
        className="size-8 shrink-0"
        priority
      />
      {showWordmark && (
        <span className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
          <span className="text-xl font-semibold tracking-tight">Nexus</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-primary uppercase">
            ai
          </span>
        </span>
      )}
    </span>
  );
}
