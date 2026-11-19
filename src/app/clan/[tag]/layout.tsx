import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeImage } from "@/components/badge-image";
import { DynamicMarker } from "@/components/dynamic-marker";
import { EntityHeader, EntityHeaderSkeleton, entityMetadata } from "@/components/entity-shell";
import { ErrorState } from "@/components/error-state";
import { RecordVisit } from "@/components/recent-searches";
import { getClan } from "@/lib/coc/client";
import { clanHref, tagToSlug } from "@/lib/coc/tag";
import { fmtInt } from "@/lib/format";
import { ClanNav } from "./clan-nav";

export async function generateMetadata({ params }: LayoutProps<"/clan/[tag]">): Promise<Metadata> {
  const { tag } = await params;
  const result = await getClan(tag);
  if (!result.ok) return { title: "Clan", robots: { index: false } };
  const c = result.data;
  return entityMetadata({
    name: c.name,
    tag: c.tag,
    href: clanHref(c.tag),
    stats: [
      `Level ${c.clanLevel} clan`,
      `${c.members}/50 members`,
      c.warLeague?.name && c.warLeague.name !== "Unranked" && c.warLeague.name,
      c.warWins != null && `${fmtInt(c.warWins)} war wins`,
      c.location?.name,
    ],
    about: "Members, wars, Clan War League and raid weekends",
    image: { url: c.badgeUrls.large ?? c.badgeUrls.medium, alt: `${c.name} badge` },
  });
}

export default function ClanLayout({ children, params }: LayoutProps<"/clan/[tag]">) {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<EntityHeaderSkeleton navClassName="h-9 w-72" />}>
        <ClanShell params={params}>{children}</ClanShell>
      </Suspense>
    </>
  );
}

/**
 * Loads the clan once for the header. If the clan can't be loaded (bad tag,
 * not found, maintenance) only that message is shown, not one per section.
 */
async function ClanShell({ params, children }: { params: LayoutProps<"/clan/[tag]">["params"]; children: React.ReactNode }) {
  const { tag: slug } = await params;
  const result = await getClan(slug);
  if (!result.ok) return <ErrorState error={result.error} />;
  const clan = result.data;
  return (
    <div className="space-y-8">
      <RecordVisit kind="clan" keyValue={clan.tag} label={clan.name} />
      <EntityHeader
        avatar={<BadgeImage src={clan.badgeUrls.medium ?? clan.badgeUrls.small} alt={`${clan.name} badge`} size={64} />}
        name={clan.name}
        details={
          <>
            <span className="font-mono">{clan.tag}</span>
            <span>Level {clan.clanLevel}</span>
            <span>{clan.members}/50 members</span>
            {clan.location && <span>{clan.location.name}</span>}
          </>
        }
        // Tabs keep the tag the visitor asked for (the same as clan.tag with the real API).
        nav={<ClanNav slug={tagToSlug(slug)} />}
      />
      {children}
    </div>
  );
}
