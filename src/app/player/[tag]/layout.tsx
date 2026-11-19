import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeImage } from "@/components/badge-image";
import { DynamicMarker } from "@/components/dynamic-marker";
import { EntityHeader, EntityHeaderSkeleton, entityMetadata } from "@/components/entity-shell";
import { ErrorState } from "@/components/error-state";
import { RecordVisit } from "@/components/recent-searches";
import { getPlayer } from "@/lib/coc/client";
import { clanHref, playerHref, tagToSlug } from "@/lib/coc/tag";
import { fmtInt, roleLabel } from "@/lib/format";
import { PlayerNav } from "./player-nav";

export async function generateMetadata({ params }: LayoutProps<"/player/[tag]">): Promise<Metadata> {
  const { tag } = await params;
  const result = await getPlayer(tag);
  if (!result.ok) return { title: "Player", robots: { index: false } };
  const p = result.data;
  const league = p.leagueTier ?? p.league;
  return entityMetadata({
    name: p.name,
    tag: p.tag,
    href: playerHref(p.tag),
    stats: [
      `Town Hall ${p.townHallLevel}`,
      league?.name && league.name !== "Unranked" && league.name,
      `${fmtInt(p.trophies)} trophies`,
      p.clan && `${roleLabel(p.role)} of ${p.clan.name}`,
    ],
    about: "Ranked league, battle log, wars, raids, upgrade progress and achievements",
    image: { url: league?.iconUrls?.large ?? league?.iconUrls?.medium, alt: league?.name },
  });
}

export default function PlayerLayout({ children, params }: LayoutProps<"/player/[tag]">) {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<EntityHeaderSkeleton navClassName="h-11 w-full" />}>
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
  // Prefer the ranked tier from the 2025 league rework; fall back to the legacy league.
  const league = p.leagueTier ?? p.league;
  return (
    <div className="space-y-8">
      <RecordVisit kind="player" keyValue={p.tag} label={p.name} />
      <EntityHeader
        avatar={
          <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-card">
            <span className="text-[10px] text-muted-foreground uppercase">TH</span>
            <span className="tabular text-xl leading-none font-semibold">{p.townHallLevel}</span>
          </div>
        }
        name={p.name}
        details={
          <>
            <span className="font-mono">{p.tag}</span>
            <span>Level {p.expLevel}</span>
            {p.clan ? (
              <Link href={clanHref(p.clan.tag)} className="flex items-center gap-1.5 whitespace-nowrap hover:text-foreground hover:underline">
                <BadgeImage src={p.clan.badgeUrls?.small} alt="" size={16} />
                {p.clan.name}
                <span className="text-muted-foreground">· {roleLabel(p.role)}</span>
              </Link>
            ) : (
              <span>No clan</span>
            )}
          </>
        }
        aside={
          league && (
            <div className="flex basis-full items-center gap-2 text-sm sm:basis-auto">
              <BadgeImage src={league.iconUrls?.small} alt="" size={36} />
              <span>{league.name}</span>
            </div>
          )
        }
        // Tabs keep the tag the visitor asked for (the same as p.tag with the real API).
        nav={<PlayerNav slug={tagToSlug(slug)} />}
      />
      {children}
    </div>
  );
}
