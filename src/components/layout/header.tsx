"use client";

import Link from "next/link";
import { LogOut, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function Header({ role }: { role: Role }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;

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

      <div className="flex items-center gap-3">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="h-9 w-9 rounded-md"
          >
            {currentTheme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-500 transition-all" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700 transition-all" />
            )}
          </Button>
        )}

        {role === "owner" && (
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        )}
      </div>
    </header>
  );
}
