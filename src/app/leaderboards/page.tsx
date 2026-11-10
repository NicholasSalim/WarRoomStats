import Link from "next/link";
import { Suspense } from "react";
import { ErrorState } from "@/components/error-state";
import { Pager } from "@/components/pager";
import { ClanRankingTable, PlayerRankingTable } from "@/components/rankings-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBuilderBaseClanRankings,
  getBuilderBasePlayerRankings,
  getCapitalRankings,
  getClanRankings,
  getLegendSeasonRankings,
  getLegendSeasons,
  getLocations,
  getPlayerRankings,
} from "@/lib/coc/client";
import { SeasonCountdown } from "@/components/season-countdown";
import { isLegendSeasonId, legendSeasonLabel, pageCount, pageSlice, parsePage } from "@/lib/coc/rankings";
import { cn } from "@/lib/utils";
import { NavSelect } from "./nav-select";

export const metadata = {
  title: "Leaderboards",
  description:
    "Official top players and clans, globally and by country: home village, Builder Base, Clan Capital and full Legend I season standings.",
};

type Kind = "players" | "clans";
/**
 * live: the official top 200 by home village trophies right now.
 * legend: a finished Legend I season, every player (players only).
 * builder: Builder Base top 200. capital: Clan Capital top 200 (clans only).
 */
type Scope = "live" | "legend" | "builder" | "capital";

const SCOPES: Record<Kind, ReadonlyArray<readonly [Scope, string]>> = {
  players: [
    ["live", "Current Season"],
    ["legend", "Past Seasons"],
    ["builder", "Builder Base"],
  ],
  clans: [
    ["live", "Trophies"],
    ["builder", "Builder Base"],
    ["capital", "Clan Capital"],
  ],
};
type SearchParams = PageProps<"/leaderboards">["searchParams"];

interface BoardParams {
  kind: Kind;
  scope: Scope;
  location: string;
  /** Legend archive season id; null means the latest finished season. */
  season: string | null;
  page: number;
}

async function readParams(searchParams: SearchParams): Promise<BoardParams> {
  const sp = await searchParams;
  const kind: Kind = sp.kind === "clans" ? "clans" : "players";
  const scope: Scope = SCOPES[kind].find(([s]) => s === sp.scope)?.[0] ?? "live";
  const location = typeof sp.location === "string" && /^\d{1,9}$/.test(sp.location) ? sp.location : "global";
  const season = typeof sp.season === "string" && isLegendSeasonId(sp.season) ? sp.season : null;
  return { kind, scope, location, season, page: parsePage(sp.page) };
}

/** The search params that identify a board (everything except the page). */
function boardParams(p: Omit<BoardParams, "page">): Record<string, string> {
  if (p.scope === "legend") return p.season ? { kind: "players", scope: "legend", season: p.season } : { kind: "players", scope: "legend" };
  const out: Record<string, string> = { kind: p.kind, location: p.location };
  if (p.scope !== "live") out.scope = p.scope;
  return out;
}

function boardHref(p: Omit<BoardParams, "page">): string {
  return `/leaderboards?${new URLSearchParams(boardParams(p))}`;
}

export default function LeaderboardsPage({ searchParams }: PageProps<"/leaderboards">) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboards</h1>
        <p className="text-sm text-muted-foreground">
          Official rankings, worldwide and by country.
        </p>
        <Suspense fallback={null}>
          <SeasonCountdown className="justify-start pt-1" />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <Controls searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  items,
  current,
  href,
}: {
  label: string;
  items: ReadonlyArray<readonly [T, string]>;
  current: T;
  href: (value: T) => string;
}) {
  return (
    <nav aria-label={label} className="inline-flex rounded-lg bg-muted p-1 text-sm">
      {items.map(([value, text]) => (
        <Link
          key={value}
          href={href(value)}
          aria-current={current === value ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
            current === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}

async function Controls({ searchParams }: { searchParams: SearchParams }) {
  const p = await readParams(searchParams);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Leaderboard type"
          items={[
            ["players", "Players"],
            ["clans", "Clans"],
          ]}
          current={p.kind}
          href={(kind) => boardHref({ ...p, kind, scope: "live" })}
        />
        <Segmented
          label={p.kind === "players" ? "Players ranking" : "Clans ranking"}
          items={SCOPES[p.kind]}
          current={p.scope}
          href={(scope) => boardHref({ ...p, scope })}
        />
      </div>
      {p.scope === "legend" ? <SeasonSelect p={p} /> : <LocationSelect p={p} />}
    </div>
  );
}

async function LocationSelect({ p }: { p: BoardParams }) {
  const locations = await getLocations();
  if (!locations.ok) return null;
  const countries = locations.data.filter((l) => l.isCountry);
  const regions = locations.data.filter((l) => !l.isCountry);
  return (
    <NavSelect
      key={`${p.kind}:${p.scope}:${p.location}`}
      id="location"
      label="Location"
      name="location"
      value={p.location}
      params={p.scope === "live" ? { kind: p.kind } : { kind: p.kind, scope: p.scope }}
    >
      <option value="global">Global</option>
      {regions.length > 0 && (
        <optgroup label="Regions">
          {regions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Countries">
        {countries.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </optgroup>
    </NavSelect>
  );
}

async function SeasonSelect({ p }: { p: BoardParams }) {
  const seasons = await getLegendSeasons();
  if (!seasons.ok || seasons.data.length === 0) return null;
  const current = p.season ?? seasons.data[0];
  const reworked = seasons.data.filter((id) => id.startsWith("v2-"));
  const older = seasons.data.filter((id) => !id.startsWith("v2-"));
  return (
    <NavSelect key={current} id="season" label="Season" name="season" value={current} params={{ kind: "players", scope: "legend" }}>
      {reworked.map((id) => (
        <option key={id} value={id}>
          {legendSeasonLabel(id)}
        </option>
      ))}
      {older.length > 0 && (
        <optgroup label="Legend League (before the league rework)">
          {older.map((id) => (
            <option key={id} value={id}>
              {legendSeasonLabel(id)}
            </option>
          ))}
        </optgroup>
      )}
    </NavSelect>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

async function Board({ searchParams }: { searchParams: SearchParams }) {
  const p = await readParams(searchParams);
  if (p.scope === "legend") return <LegendBoard p={p} />;

  const points = p.scope === "builder" ? "Builder Base" : p.scope === "capital" ? "Capital trophies" : "Trophies";
  if (p.kind === "clans") {
    const result =
      p.scope === "builder"
        ? await getBuilderBaseClanRankings(p.location)
        : p.scope === "capital"
          ? await getCapitalRankings(p.location)
          : await getClanRankings(p.location);
    if (!result.ok) return <ErrorState error={result.error} />;
    return (
      <LivePages
        p={p}
        total={result.data.length}
        table={(page) => <ClanRankingTable rows={pageSlice(result.data, page)} pointsLabel={points} />}
      />
    );
  }
  const result = p.scope === "builder" ? await getBuilderBasePlayerRankings(p.location) : await getPlayerRankings(p.location);
  if (!result.ok) return <ErrorState error={result.error} />;
  return (
    <LivePages
      p={p}
      total={result.data.length}
      table={(page) => <PlayerRankingTable rows={pageSlice(result.data, page)} pointsLabel={points} />}
    />
  );
}

/** The live top 200, cut into pages of 100 here (one API call covers all pages). */
function LivePages({ p, total, table }: { p: BoardParams; total: number; table: (page: number) => React.ReactNode }) {
  const totalPages = pageCount(total);
  const page = Math.min(p.page, totalPages);
  const pager = <Pager path="/leaderboards" params={boardParams(p)} page={page} totalPages={totalPages} />;
  return (
    <div className="space-y-3">
      {pager}
      {table(page)}
      {pager}
    </div>
  );
}

async function LegendBoard({ p }: { p: BoardParams }) {
  const seasons = await getLegendSeasons();
  if (!seasons.ok) return <ErrorState error={seasons.error} />;
  const season = p.season ?? seasons.data[0];
  if (!season) return <PlayerRankingTable rows={[]} empty="No finished Legend seasons yet." />;
  const result = await getLegendSeasonRankings(season, p.page);
  if (!result.ok) return <ErrorState error={result.error} />;
  const { items, hasMore } = result.data;
  const params = boardParams({ ...p, season });
  const pager = <Pager path="/leaderboards" params={params} page={p.page} hasMore={hasMore} />;
  return (
    <div className="space-y-3">
      {pager}
      <PlayerRankingTable
        rows={items}
        empty={
          <>
            This season has no players on page {p.page}.{" "}
            <Link href={boardHref({ ...p, season })} className="text-foreground underline">
              Back to page 1
            </Link>
          </>
        }
      />
      {items.length > 0 && pager}
      <Caption>
        Final standings, Legend I season {legendSeasonLabel(season).replace(/^Ended/, "ended")}.
      </Caption>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
