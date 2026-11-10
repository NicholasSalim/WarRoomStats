import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeImage } from "@/components/badge-image";
import { DynamicMarker } from "@/components/dynamic-marker";
import { ErrorState } from "@/components/error-state";
import { RecordVisit } from "@/components/recent-searches";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlayer } from "@/lib/coc/client";
import { clanHref, normalizeTag, playerHref } from "@/lib/coc/tag";
import { fmtInt, roleLabel } from "@/lib/format";
import { PlayerNav } from "./player-nav";

export async function generateMetadata({ params }: LayoutProps<"/player/[tag]">): Promise<Metadata> {
  const { tag } = await params;
  const result = await getPlayer(tag);
  if (!result.ok) return { title: "Player", robots: { index: false } };
  const p = result.data;
  const title = `${p.name} (${p.tag})`;
  const league = p.leagueTier ?? p.league;
  const stats = [
    `Town Hall ${p.townHallLevel}`,
    league?.name && league.name !== "Unranked" ? league.name : null,
    `${fmtInt(p.trophies)} trophies`,
    p.clan ? `${roleLabel(p.role)} of ${p.clan.name}` : null,
  ].filter(Boolean);
  const description = `${stats.join(" · ")}. Ranked league, battle log, wars, raids, upgrade progress and achievements for ${p.name}.`;
  const icon = league?.iconUrls?.large ?? league?.iconUrls?.medium;
  return {
    title,
    description,
    alternates: { canonical: playerHref(p.tag) },
    openGraph: { title, description, url: playerHref(p.tag), images: icon ? [{ url: icon, alt: league?.name }] : undefined },
  };
}

export default function PlayerLayout({ children, params }: LayoutProps<"/player/[tag]">) {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<PlayerHeaderSkeleton />}>
        <PlayerShell params={params}>{children}</PlayerShell>
      </Suspense>
    </>
  );
}

/**
 * Loads the player once for the header and tabs (every tab reads the same
 * cached profile). If the player can't be loaded only that message is shown.
 */
async function PlayerShell({ params, children }: { params: LayoutProps<"/player/[tag]">["params"]; children: React.ReactNode }) {
  const { tag: slug } = await params;
  const result = await getPlayer(slug);
  if (!result.ok) return <ErrorState error={result.error} />;
  const p = result.data;
  const urlSlug = normalizeTag(slug)!.slice(1);
  // Prefer the ranked tier from the 2025 league rework; fall back to the legacy league.
  const league = p.leagueTier ?? p.league;
  return (
    <div className="space-y-8">
      <RecordVisit kind="player" keyValue={p.tag} label={p.name} />
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-card">
            <span className="text-[10px] text-muted-foreground uppercase">TH</span>
            <span className="tabular text-xl leading-none font-semibold">{p.townHallLevel}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{p.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              <span className="font-mono">{p.tag}</span>
              <span>Level {p.expLevel}</span>
              {p.clan ? (
                <Link
                  href={clanHref(p.clan.tag)}
                  className="flex items-center gap-1.5 whitespace-nowrap hover:text-foreground hover:underline"
                >
                  <BadgeImage src={p.clan.badgeUrls?.small} alt="" size={16} />
                  {p.clan.name}
                  <span className="text-muted-foreground">· {roleLabel(p.role)}</span>
                </Link>
              ) : (
                <span>No clan</span>
              )}
            </p>
          </div>
          {league && (
            <div className="flex basis-full items-center gap-2 text-sm sm:basis-auto">
              <BadgeImage src={league.iconUrls?.small} alt="" size={36} />
              <span>{league.name}</span>
            </div>
          )}
        </div>
        <PlayerNav slug={urlSlug} />
      </header>
      {children}
    </div>
  );
}

function PlayerHeaderSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
