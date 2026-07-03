"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  shortLabel?: string;
  disabled?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quotes/new", label: "New Quote", shortLabel: "New" },
  { href: "/quotes", label: "Quotes" },
  { href: "/settings", label: "Settings" },
];

interface SidebarNavProps {
  /** "vertical" for the desktop sidebar, "horizontal" for the mobile top bar. */
  orientation?: "vertical" | "horizontal";
}

export default function SidebarNav({ orientation = "vertical" }: SidebarNavProps): ReactNode {
  const pathname = usePathname();
  const horizontal = orientation === "horizontal";

  return (
    <nav
      aria-label="Primary"
      className={
        horizontal
          ? "flex flex-1 items-center gap-1 overflow-x-auto"
          : "flex flex-1 flex-col gap-1"
      }
    >
      {/* Longest matching href wins so /quotes/new lights only "New Quote" */}
      {NAV_ITEMS.map((item) => {
        const matches = (href: string) =>
          pathname === href || pathname?.startsWith(`${href}/`);
        const bestMatch = NAV_ITEMS.filter((i) => !i.disabled && matches(i.href))
          .sort((a, b) => b.href.length - a.href.length)[0];
        const active = bestMatch?.href === item.href;

        if (item.disabled) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className={
                horizontal
                  ? "flex flex-none items-center gap-1 whitespace-nowrap rounded-sm px-3 py-2 text-sm text-muted opacity-50"
                  : "flex items-center justify-between rounded-sm px-3 py-2 text-sm text-muted opacity-50"
              }
            >
              {horizontal ? (item.shortLabel ?? item.label) : item.label}
              {item.badge && (
                <span className="font-display text-[11px] italic text-muted">
                  {item.badge}
                </span>
              )}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex-none whitespace-nowrap rounded-sm px-3 py-2 text-sm transition duration-150 ${
              active
                ? "bg-accent-light font-medium text-accent"
                : "text-ink hover:bg-accent-light hover:text-accent"
            }`}
          >
            {horizontal ? (item.shortLabel ?? item.label) : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
