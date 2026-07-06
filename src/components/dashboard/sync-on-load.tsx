"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";

// Owner-only. On mount it fires a background sync (fire-and-forget) and refreshes
// the server component when it resolves so fresh data appears. Demo users render
// nothing and never trigger a sync.
export function SyncOnLoad({ role }: { role: Role }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const didAutoSync = useRef(false);

  async function runSync(force: boolean) {
    setSyncing(true);
    try {
      await fetch(force ? "/api/sync?force=1" : "/api/sync", {
        method: "POST",
      });
      router.refresh();
    } catch {
      // Fire-and-forget: a failed background sync must not disrupt the page.
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (role !== "owner" || didAutoSync.current) return;
    didAutoSync.current = true;
    void runSync(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (role !== "owner") return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={syncing}
      onClick={() => void runSync(true)}
    >
      <RefreshCw className={syncing ? "animate-spin" : undefined} />
      {syncing ? "Syncing…" : "Sync now"}
    </Button>
  );
}
