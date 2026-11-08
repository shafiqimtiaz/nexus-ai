"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiMagicIcon,
  ComputerIcon,
  Logout01Icon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { openChat } from "@/lib/chat-events";
import type { Role } from "@/lib/auth";
import { useHydrated } from "@/lib/use-hydrated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Brand } from "@/components/layout/brand";
import { MobileNav } from "@/components/layout/mobile-nav";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun03Icon },
  { value: "dark", label: "Dark", icon: Moon02Icon },
  { value: "system", label: "System", icon: ComputerIcon },
];

function ThemeMenu() {
  const { theme = "system", setTheme, resolvedTheme } = useTheme();
  const mounted = useHydrated();
  if (!mounted) return <span className="size-9" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-lg" aria-label="Change theme" />}
      >
        <HugeiconsIcon icon={resolvedTheme === "dark" ? Moon02Icon : Sun03Icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEME_OPTIONS.map(({ value, label, icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <HugeiconsIcon icon={icon} />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({ role }: { role: Role }) {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  if (pathname?.startsWith("/login")) return null;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-6">
      <MobileNav />
      <Brand className="md:hidden" />

      {!pathname?.startsWith("/chat") && (
        <Button
          variant="outline"
          onClick={() => openChat()}
          className="hidden h-9 w-full max-w-sm justify-start gap-2 bg-card font-normal text-muted-foreground md:inline-flex"
        >
          <HugeiconsIcon icon={AiMagicIcon} className="text-primary" />
          Ask Nexus anything…
          <Kbd className="ml-auto">⌘K</Kbd>
        </Button>
      )}

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {role === "demo" ? (
          <>
            <Badge variant="secondary" className="hidden h-6 sm:inline-flex">
              Demo mode · read-only
            </Badge>
            <Button
              variant="default"
              size="lg"
              render={<Link href="/login" />}
              nativeButton={false}
            >
              Log in
            </Button>
          </>
        ) : (
          <Button variant="outline" size="lg" onClick={handleLogout}>
            <HugeiconsIcon icon={Logout01Icon} />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        )}
        <ThemeMenu />
      </div>
    </header>
  );
}
