"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon, Sun03Icon, Moon02Icon, AiMagicIcon } from "@hugeicons/core-free-icons";
import { openChat } from "@/lib/chat-events";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";
import { useTheme } from "next-themes";
import { useHydrated } from "@/lib/use-hydrated";

export function Header({ role }: { role: Role }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useHydrated();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;

  if (pathname?.startsWith("/login")) return null;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
      {!pathname?.startsWith("/chat") && (
        <button
          type="button"
          onClick={() => openChat()}
          className="hidden h-9 w-full max-w-xs cursor-pointer items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted md:flex"
        >
          <HugeiconsIcon icon={AiMagicIcon} className="h-4 w-4 text-primary" />
          Ask Nexus anything…
          <kbd className="ml-auto rounded border bg-background px-1.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>
      )}
      {role === "demo" ? (
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Demo mode
          </span>
          <span className="whitespace-nowrap text-muted-foreground">
            <span className="hidden lg:inline">Read-only. </span>
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
            <span className="hidden lg:inline"> for full access.</span>
          </span>
        </div>
      ) : (
        <span className="md:hidden" />
      )}

      <div className="ml-auto flex items-center gap-3">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="h-9 w-9 rounded-md"
          >
            {currentTheme === "dark" ? (
              <HugeiconsIcon icon={Sun03Icon} className="h-4 w-4 text-amber-500 transition-all" />
            ) : (
              <HugeiconsIcon icon={Moon02Icon} className="h-4 w-4 text-slate-700 transition-all" />
            )}
          </Button>
        )}

        {role === "owner" && (
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <HugeiconsIcon icon={Logout01Icon} className="h-4 w-4" />
            Log out
          </Button>
        )}
      </div>
    </header>
  );
}
