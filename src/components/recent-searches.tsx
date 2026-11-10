"use client";

import Link from "next/link";
import { useEffect } from "react";
import { History, Shield, User, Search, X } from "lucide-react";
import { addRecent, clearRecent, removeRecent, useRecent, type RecentKind } from "@/lib/recent";
import { clanHref, playerHref } from "@/lib/coc/tag";

/** Records a visit as a recent search. Renders nothing. */
export function RecordVisit({ kind, keyValue, label }: { kind: RecentKind; keyValue: string; label: string }) {
  useEffect(() => {
    addRecent({ kind, key: keyValue, label });
  }, [kind, keyValue, label]);
  return null;
}

const ICONS = { clan: Shield, player: User, clanSearch: Search } as const;

function hrefFor(kind: RecentKind, key: string): string {
  if (kind === "clan") return clanHref(key);
  if (kind === "player") return playerHref(key);
  return `/search?${key}`;
}

export function RecentSearches() {
  const recent = useRecent();
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby="recent-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="recent-title" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History className="size-4" aria-hidden /> Recent
        </h2>
        <button
          type="button"
          onClick={clearRecent}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" aria-hidden /> Clear all
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {recent.map((e) => {
          const Icon = ICONS[e.kind];
          return (
            <li key={`${e.kind}:${e.key}`} className="relative">
              <Link
                href={hrefFor(e.kind, e.key)}
                className="flex items-center gap-3 rounded-lg border border-border py-2 pr-10 pl-3 text-sm transition-colors hover:bg-muted"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{e.label}</span>
                {e.kind !== "clanSearch" && (
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{e.key}</span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => removeRecent(e.kind, e.key)}
                aria-label={`Remove ${e.label} from recent searches`}
                title="Remove"
                className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
