"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";

type SyncRow = { type: string; skipped?: boolean; authExpired?: boolean };

export function SyncOnLoad({ role }: { role: Role }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const didAutoSync = useRef(false);

  async function runSync(force: boolean) {
    setSyncing(true);
    try {
      const res = await fetch(force ? "/api/sync?force=1" : "/api/sync", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      const rows: SyncRow[] = Array.isArray(data?.synced) ? data.synced : [];
      const expired = rows.filter((r) => r.authExpired).map((r) => r.type);
      if (expired.length > 0) {
        toast.error(
          `${expired.join(" and ")} token expired. Reconnect it in Settings to resume syncing.`
        );
      }
      const didWork = !Array.isArray(data?.synced) || rows.some((r) => !r.skipped);
      if (didWork) router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (role !== "owner") return;
    if (!didAutoSync.current) {
      didAutoSync.current = true;
      void runSync(false);
    }
    const interval = setInterval(() => void runSync(false), 15 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (role !== "owner") return null;

  return (
    <Button variant="outline" size="sm" disabled={syncing} onClick={() => void runSync(true)}>
      <HugeiconsIcon icon={RefreshIcon} className={syncing ? "animate-spin" : undefined} />
      {syncing ? "Syncing…" : "Sync now"}
    </Button>
  );
}
