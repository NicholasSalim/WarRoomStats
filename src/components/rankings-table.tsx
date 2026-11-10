import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { BadgeImage } from "@/components/badge-image";
import type { ClanRanking, PlayerRanking } from "@/lib/coc/schemas";
import { clanHref, playerHref } from "@/lib/coc/tag";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

// Player and clan ranking tables, shared by the leaderboards page and the
// home page's top-20 lists. `compact` drops the secondary columns.

function RankChange({ rank, previous }: { rank: number; previous?: number }) {
  if (!previous || previous <= 0 || previous === rank) return <span className="sr-only">no change</span>;
  const up = previous > rank;
  return (
    <span className="inline-flex items-center text-xs text-muted-foreground" title={`Previously #${previous}`}>
      {up ? <ArrowUp className="size-3" aria-label="up" /> : <ArrowDown className="size-3" aria-label="down" />}
      {Math.abs(previous - rank)}
    </span>
  );
}

function Empty({ children = "No rankings for this location yet." }: { children?: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th scope="col" className={cn("px-3 py-2 font-medium", className)}>
      {children}
    </th>
  );
}

function RankCell({ rank, previous }: { rank: number; previous?: number }) {
  return (
    <td className="tabular px-3 py-2 text-right">
      <div className="flex items-center justify-end gap-2">
        <RankChange rank={rank} previous={previous} />
        {fmtInt(rank)}
      </div>
    </td>
  );
}

export function PlayerRankingTable({
  rows,
  compact = false,
  empty,
  pointsLabel = "Trophies",
}: {
  rows: PlayerRanking[];
  compact?: boolean;
  empty?: React.ReactNode;
  pointsLabel?: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  // Builder Base rankings have no attack wins.
  const attacks = !compact && rows.some((r) => r.attackWins !== undefined);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-card text-xs text-muted-foreground">
          <tr>
            <Th className="w-20 text-right">Rank</Th>
            <Th className="text-left">Player</Th>
            {!compact && <Th className="hidden text-left md:table-cell">Clan</Th>}
            {attacks && <Th className="hidden text-right sm:table-cell">Attacks won</Th>}
            <Th className="text-right">{pointsLabel}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.tag} className="transition-colors hover:bg-muted/60">
              <RankCell rank={r.rank} previous={r.previousRank} />
              <td className="max-w-0 px-3 py-2">
                <Link href={playerHref(r.tag)} className="block truncate font-medium hover:underline">
                  {r.name}
                </Link>
                {r.clan && (
                  <span className={cn("block truncate text-xs text-muted-foreground", !compact && "md:hidden")}>
                    {r.clan.name}
                  </span>
                )}
              </td>
              {!compact && (
                <td className="hidden max-w-0 px-3 py-2 md:table-cell">
                  {r.clan && (
                    <Link
                      href={clanHref(r.clan.tag)}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:underline"
                    >
                      <BadgeImage src={r.clan.badgeUrls?.small} alt="" size={18} />
                      <span className="truncate">{r.clan.name}</span>
                    </Link>
                  )}
                </td>
              )}
              {attacks && (
                <td className="tabular hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                  {r.attackWins === undefined ? "–" : fmtInt(r.attackWins)}
                </td>
              )}
              <td className="tabular px-3 py-2 text-right font-medium">{fmtInt(r.trophies)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClanRankingTable({
  rows,
  compact = false,
  empty,
  pointsLabel = "Trophies",
}: {
  rows: ClanRanking[];
  compact?: boolean;
  empty?: React.ReactNode;
  pointsLabel?: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-card text-xs text-muted-foreground">
          <tr>
            <Th className="w-20 text-right">Rank</Th>
            <Th className="text-left">Clan</Th>
            {!compact && <Th className="hidden text-left md:table-cell">Location</Th>}
            {!compact && <Th className="hidden text-right sm:table-cell">Members</Th>}
            <Th className="text-right">{pointsLabel}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.tag} className="transition-colors hover:bg-muted/60">
              <RankCell rank={r.rank} previous={r.previousRank} />
              <td className="max-w-0 px-3 py-2">
                <Link href={clanHref(r.tag)} className="flex items-center gap-2 hover:underline">
                  <BadgeImage src={r.badgeUrls?.small} alt="" size={24} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    {compact && r.location && (
                      <span className="block truncate text-xs text-muted-foreground">{r.location.name}</span>
                    )}
                  </span>
                  {!compact && <span className="hidden shrink-0 text-xs text-muted-foreground lg:inline">Lv {r.clanLevel}</span>}
                </Link>
              </td>
              {!compact && <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{r.location?.name ?? "–"}</td>}
              {!compact && <td className="tabular hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">{r.members}</td>}
              <td className="tabular px-3 py-2 text-right font-medium">{fmtInt(r.clanPoints)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
