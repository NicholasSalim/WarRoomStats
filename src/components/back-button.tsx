"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface NavigationLike {
  currentEntry?: { index: number } | null;
  entries?: () => Array<{ url: string | null }>;
}

/** Whether the previous history entry is a page of this site. */
function previousIsThisSite(): boolean {
  try {
    // The Navigation API sees in-app (client-side) navigations; the referrer doesn't.
    const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
    if (nav?.currentEntry && nav.entries) {
      const prev = nav.entries()[nav.currentEntry.index - 1];
      return !!prev?.url && new URL(prev.url).origin === window.location.origin;
    }
    return window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Where Back goes without in-app history: one level up for nested pages
 * (/player/X/season -> /player/X, /clan/X/war -> /clan/X), otherwise home.
 */
export function backFallback(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if ((parts[0] === "player" || parts[0] === "clan") && parts.length > 2) return `/${parts[0]}/${parts[1]}`;
  return "/";
}

/**
 * "Back", shown on every page except home (it sits in the root layout).
 * Returns to the previous page when it was on this site, otherwise goes to
 * the fallback. Without JS it's a plain link to the fallback.
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <Link
      href={backFallback(pathname)}
      onClick={(e) => {
        if (previousIsThisSite()) {
          e.preventDefault();
          router.back();
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back
    </Link>
  );
}
