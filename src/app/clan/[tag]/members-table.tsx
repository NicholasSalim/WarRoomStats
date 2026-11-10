"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { BadgeImage } from "@/components/badge-image";
import type { ClanMember } from "@/lib/coc/schemas";
import { donationRatio } from "@/lib/coc/stats";
import { playerHref } from "@/lib/coc/tag";
import { fmtInt, fmtRatio, roleLabel, roleRank } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "rank" | "name" | "role" | "th" | "trophies" | "donations" | "received" | "ratio";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; className?: string }[] = [
  { key: "rank", label: "#", numeric: true, className: "w-16" },
  { key: "name", label: "Player" },
  { key: "role", label: "Role", className: "hidden md:table-cell" },
  { key: "th", label: "TH", numeric: true },
  { key: "trophies", label: "Trophies", numeric: true },
  { key: "donations", label: "Donated", numeric: true, className: "hidden sm:table-cell" },
  { key: "received", label: "Received", numeric: true, className: "hidden sm:table-cell" },
  { key: "ratio", label: "Ratio", numeric: true, className: "hidden lg:table-cell" },
];

function value(m: ClanMember, key: SortKey): number | string {
  switch (key) {
    case "rank":
      return m.clanRank;
    case "name":
      return m.name.toLowerCase();
    case "role":
      return roleRank(m.role);
    case "th":
      return m.townHallLevel ?? 0;
    case "trophies":
      return m.trophies;
    case "donations":
      return m.donations;
    case "received":
      return m.donationsReceived;
    case "ratio": {
      const r = donationRatio(m.donations, m.donationsReceived);
      return r == null ? -1 : r;
    }
  }
}

export function MembersTable({ members }: { members: ClanMember[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "rank", desc: false });

  const rows = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
      return sort.desc ? -cmp : cmp;
    });
    return sorted;
  }, [members, sort]);

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, desc: !s.desc }
        : { key, desc: !["rank", "name", "role"].includes(key) }, // numbers default high-to-low
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-card text-xs text-muted-foreground">
          <tr>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
                  className={cn("px-3 py-2 font-medium", c.numeric ? "text-right" : "text-left", c.className)}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground",
                      active && "text-foreground",
                      c.numeric && "flex-row-reverse",
                    )}
                  >
                    {c.label}
                    {active && (sort.desc ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((m) => (
            <tr key={m.tag} className="transition-colors hover:bg-muted/60">
              <td className="tabular px-3 py-2 text-right text-muted-foreground">
                <span className="inline-flex items-center justify-end gap-1">
                  <RankMove rank={m.clanRank} previous={m.previousClanRank} />
                  {m.clanRank}
                </span>
              </td>
              <td className="px-3 py-2">
                <Link href={playerHref(m.tag)} className="flex items-center gap-2 hover:underline">
                  {(m.leagueTier ?? m.league)?.iconUrls?.small && (
                    <BadgeImage
                      src={(m.leagueTier ?? m.league)!.iconUrls!.small}
                      alt={(m.leagueTier ?? m.league)!.name}
                      size={20}
                    />
                  )}
                  <span className="font-medium break-all sm:break-normal">{m.name}</span>
                </Link>
                <span className="text-xs text-muted-foreground md:hidden">{roleLabel(m.role)}</span>
              </td>
              <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{roleLabel(m.role)}</td>
              <td className="tabular px-3 py-2 text-right">{m.townHallLevel ?? "–"}</td>
              <td className="tabular px-3 py-2 text-right">{fmtInt(m.trophies)}</td>
              <td className="tabular hidden px-3 py-2 text-right sm:table-cell">{fmtInt(m.donations)}</td>
              <td className="tabular hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                {fmtInt(m.donationsReceived)}
              </td>
              <td className="tabular hidden px-3 py-2 text-right text-muted-foreground lg:table-cell">
                {fmtRatio(donationRatio(m.donations, m.donationsReceived))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Movement in the clan's trophy order since the API's previous snapshot. */
function RankMove({ rank, previous }: { rank: number; previous?: number }) {
  if (!previous || previous <= 0 || previous === rank) return null;
  const up = previous > rank;
  return (
    <span
      className={cn("inline-flex items-center text-[10px]", up ? "text-win-foreground" : "text-loss-foreground")}
      title={`Previously #${previous}`}
    >
      {up ? <ArrowUp className="size-3" aria-label="up" /> : <ArrowDown className="size-3" aria-label="down" />}
      {Math.abs(previous - rank)}
    </span>
  );
}
