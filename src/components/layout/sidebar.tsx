"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  Calendar03Icon,
  BookOpen01Icon,
  AiChat02Icon,
  Settings01Icon,
  ArrowLeftDoubleIcon,
  ArrowRightDoubleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: DashboardSquare01Icon },
  { href: "/calendar", label: "Calendar", icon: Calendar03Icon },
  { href: "/resources", label: "Resources", icon: BookOpen01Icon },
  { href: "/chat", label: "AI Chat", icon: AiChat02Icon },
  { href: "/options", label: "Options", icon: Settings01Icon },
];

const COLLAPSED_STORAGE = "nexus_sidebar_collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const sync = () =>
      setCollapsed(mql.matches || localStorage.getItem(COLLAPSED_STORAGE) === "true");
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
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
        "flex h-full shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 items-center border-b px-4",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Image
              src="/nexus-icon.png"
              alt="Nexus"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
              priority
            />
            <span className="flex items-center gap-1 whitespace-nowrap overflow-hidden">
              <span className="text-xl font-semibold tracking-tight">Nexus</span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                ai
              </span>
            </span>
          </div>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
            collapsed && "flex h-8 w-8 items-center justify-center p-0"
          )}
        >
          {collapsed ? (
            <HugeiconsIcon icon={ArrowRightDoubleIcon} className="h-4 w-4 shrink-0" />
          ) : (
            <HugeiconsIcon icon={ArrowLeftDoubleIcon} className="h-4 w-4 shrink-0" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ href, label, icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-primary/10 text-primary before:absolute before:inset-y-2 before:-left-2 before:w-1 before:rounded-r-full before:bg-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <HugeiconsIcon icon={icon} className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
