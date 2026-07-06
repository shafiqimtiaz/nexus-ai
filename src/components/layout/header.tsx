"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";

export function Header({ role }: { role: Role }) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-6">
      {role === "demo" ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Demo mode
          </span>
          <span className="text-muted-foreground">
            Read-only.{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Log in
            </Link>{" "}
            for full access.
          </span>
        </div>
      ) : (
        <span className="text-sm font-medium text-muted-foreground">
          Signed in
        </span>
      )}

      {role === "owner" && (
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      )}
    </header>
  );
}
