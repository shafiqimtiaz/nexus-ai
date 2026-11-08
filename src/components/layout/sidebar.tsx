"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon, SidebarLeftIcon, SidebarRightIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { openChat } from "@/lib/chat-events";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Brand } from "@/components/layout/brand";
import { NAV_ITEMS, isActive } from "@/components/layout/nav-items";

const COLLAPSED_STORAGE = "nexus_sidebar_collapsed";

export function NavLinks({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isActive(pathname, href);
        const link = (
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              "group/nav relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              collapsed && "justify-center px-0",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-sidebar-primary"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            )}
          >
            <HugeiconsIcon
              icon={icon}
              className={cn("size-[18px] shrink-0", active && "text-sidebar-primary")}
            />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
        if (!collapsed) return <div key={href}>{link}</div>;
        return (
          <Tooltip key={href}>
            <TooltipTrigger render={link} />
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setCollapsed(localStorage.getItem(COLLAPSED_STORAGE) === "true")
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSED_STORAGE, String(!c));
      return !c;
    });

  if (pathname?.startsWith("/login")) return null;

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out md:flex",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div
        className={cn("flex h-16 shrink-0 items-center px-5", collapsed && "justify-center px-0")}
      >
        <Link
          href="/"
          aria-label="Nexus home"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Brand showWordmark={!collapsed} onDark />
        </Link>
      </div>

      <div className={cn("flex-1 px-3 pt-2", collapsed && "px-3")}>
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-sidebar-foreground/40 uppercase">
            Workspace
          </p>
        )}
        <NavLinks collapsed={collapsed} />
      </div>

      <div className="space-y-3 p-3">
        <Separator className="bg-sidebar-border" />
        {!collapsed && (
          <Button
            variant="ghost"
            onClick={() => openChat()}
            className="h-10 w-full justify-start gap-2.5 bg-sidebar-accent/70 px-3 text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <HugeiconsIcon icon={AiMagicIcon} className="text-sidebar-primary" />
            Quick ask
            <Kbd className="ml-auto bg-sidebar-border text-sidebar-foreground/70">⌘K</Kbd>
          </Button>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon-lg" : "sm"}
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "mx-auto flex" : "w-full justify-start gap-2.5 px-3"
          )}
        >
          <HugeiconsIcon icon={collapsed ? SidebarRightIcon : SidebarLeftIcon} />
          {!collapsed && "Collapse"}
        </Button>
      </div>
    </aside>
  );
}
