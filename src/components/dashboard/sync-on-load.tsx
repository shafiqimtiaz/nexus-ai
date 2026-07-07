"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";

type SyncRow = { type: string; skipped?: boolean; authExpired?: boolean };

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
      const res = await fetch(force ? "/api/sync?force=1" : "/api/sync", {
        method: "POST",
      });
      // Skip the full server re-render when every platform was staleness-skipped
      // (nothing changed). On parse failure, refresh anyway to stay safe.
      const data = await res.json().catch(() => null);
      const rows: SyncRow[] = Array.isArray(data?.synced) ? data.synced : [];
      // A rejected token was flipped to disconnected server-side — tell the user
      // to reconnect it in Options.
      const expired = rows.filter((r) => r.authExpired).map((r) => r.type);
      if (expired.length > 0) {
        toast.error(
          `${expired.join(" and ")} token expired. Reconnect it in Options to resume syncing.`
        );
      }
      const didWork = !Array.isArray(data?.synced) || rows.some((r) => !r.skipped);
      if (didWork) router.refresh();
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
    <Button variant="outline" size="sm" disabled={syncing} onClick={() => void runSync(true)}>
      <HugeiconsIcon icon={RefreshIcon} className={syncing ? "animate-spin" : undefined} />
      {syncing ? "Syncing…" : "Sync now"}
    </Button>
  );
}
