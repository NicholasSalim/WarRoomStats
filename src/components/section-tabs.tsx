"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionTab {
  /** Path after the base (e.g. "/war"); "" is the overview. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Other sub-paths that belong to this tab. */
  also?: string[];
}

/**
 * Tab bar for a clan or player's sections, each its own route. Scrolls
 * sideways on narrow screens and brings the active tab into view.
 */
export function SectionTabs({ label, base, tabs }: { label: string; base: string; tabs: SectionTab[] }) {
  const pathname = usePathname();
  // Tags are case-insensitive in URLs, so compare the part after /{kind}/{tag}.
  const sub = pathname.split("/").slice(3).join("/");
  const current = sub ? `/${sub.toLowerCase()}` : "";
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);
  return (
    <nav
      aria-label={label}
      className="-mx-4 overflow-x-auto overflow-y-hidden border-y border-border bg-card/40 px-4 scrollbar-none [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex gap-1 text-sm">
        {tabs.map((tab) => {
          const active = current === tab.path || (tab.also ?? []).includes(current);
          const Icon = tab.icon;
          return (
            <li key={tab.path}>
              <Link
                href={`${base}${tab.path}`}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-3 font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
