import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { RecentSearches } from "@/components/recent-searches";
import { SeasonCountdown } from "@/components/season-countdown";
import { ClanRankingTable, PlayerRankingTable } from "@/components/rankings-table";
import { Skeleton } from "@/components/ui/skeleton";
import { getClanLabels, getClanRankings, getLocations, getPlayerRankings } from "@/lib/coc/client";
import { SearchPanel } from "./search-panel";

/** How many rows each home-page leaderboard shows. */
const TOP = 20;

export default function Home() {
  // Not awaited: the form renders straight away and the location list streams in.
  const locations = getLocations();
  const labels = getClanLabels();
  return (
    <div className="space-y-16 sm:space-y-24">
      <section className="mx-auto max-w-3xl space-y-10 pt-8 sm:pt-20">
        <div className="space-y-5 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Clan and player stats, live.</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-balance sm:text-xl">
            Look up any clan or player to see wars, Clan War League, raid weekends, heroes and more.
          </p>
        </div>
        <SearchPanel locations={locations} labels={labels} />
        <RecentSearches />
      </section>

      <section aria-labelledby="leaderboards-title" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="leaderboards-title" className="text-2xl font-semibold tracking-tight">
              Leaderboards
            </h2>
            <p className="text-sm text-muted-foreground">The global top {TOP} right now.</p>
          </div>
          <Link href="/leaderboards" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            All leaderboards <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <Suspense fallback={null}>
          <SeasonCountdown className="justify-start" />
        </Suspense>
        <div className="grid gap-8 lg:grid-cols-2">
          <TopList
            title="Top players"
            links={[{ href: "/leaderboards?kind=players", label: "Top players" }]}
          >
            <Suspense fallback={<ListSkeleton />}>
              <TopPlayers />
            </Suspense>
          </TopList>
          <TopList title="Top clans" links={[{ href: "/leaderboards?kind=clans", label: "Top clans" }]}>
            <Suspense fallback={<ListSkeleton />}>
              <TopClans />
            </Suspense>
          </TopList>
        </div>
      </section>
    </div>
  );
}

function TopList({
  title,
  links,
  children,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="font-medium">{title}</h3>
      {children}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            {l.label} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}

async function TopPlayers() {
  const result = await getPlayerRankings("global");
  if (!result.ok) return <ErrorState error={result.error} />;
  return <PlayerRankingTable compact rows={result.data.slice(0, TOP)} />;
}

async function TopClans() {
  const result = await getClanRankings("global");
  if (!result.ok) return <ErrorState error={result.error} />;
  return <ClanRankingTable compact rows={result.data.slice(0, TOP)} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
