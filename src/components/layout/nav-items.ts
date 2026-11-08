import type { IconSvgElement } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  Calendar03Icon,
  BookOpen01Icon,
  AiChat02Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";

export type NavItem = { href: string; label: string; hint: string; icon: IconSvgElement };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", hint: "Your day at a glance", icon: DashboardSquare01Icon },
  {
    href: "/calendar",
    label: "Calendar",
    hint: "Exams, deadlines, study blocks",
    icon: Calendar03Icon,
  },
  {
    href: "/resources",
    label: "Library",
    hint: "Saved links and references",
    icon: BookOpen01Icon,
  },
  { href: "/chat", label: "Ask Nexus", hint: "Your AI study agent", icon: AiChat02Icon },
  { href: "/options", label: "Settings", hint: "Connections and AI rules", icon: Settings01Icon },
];

export function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
