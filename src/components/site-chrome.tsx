import Link from "next/link";

function Logo() {
  // Our own mark: three bars of a stat chart. No game assets in the logo.
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
      <rect x="2" y="10" width="4" height="8" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="8" y="5" width="4" height="13" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="14" y="2" width="4" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          WarRoomStats
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            Search
          </Link>
          <Link
            href="/leaderboards"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Leaderboards
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Fan Content Policy notice, required on every page (docs/DECISIONS.md > Product). */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-xs leading-relaxed text-muted-foreground">
        <p>
          This material is unofficial and is not endorsed by Supercell. For more information see Supercell&apos;s Fan
          Content Policy:{" "}
          <a
            href="https://www.supercell.com/fan-content-policy"
            className="underline underline-offset-2 hover:text-foreground"
            rel="noopener noreferrer"
            target="_blank"
          >
            www.supercell.com/fan-content-policy
          </a>
          .
        </p>
        <p>WarRoomStats is free and non-commercial. Data comes live from the official game API.</p>
      </div>
    </footer>
  );
}
