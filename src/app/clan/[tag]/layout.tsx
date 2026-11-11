import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeImage } from "@/components/badge-image";
import { DynamicMarker } from "@/components/dynamic-marker";
import { ErrorState } from "@/components/error-state";
import { RecordVisit } from "@/components/recent-searches";
import { Skeleton } from "@/components/ui/skeleton";
import { getClan } from "@/lib/coc/client";
import { clanHref, normalizeTag, tagToSlug } from "@/lib/coc/tag";
import { fmtInt } from "@/lib/format";
import { ClanNav } from "./clan-nav";

export async function generateMetadata({ params }: LayoutProps<"/clan/[tag]">): Promise<Metadata> {
  const { tag } = await params;
  const result = await getClan(tag);
  if (!result.ok) return { title: "Clan", robots: { index: false } };
  const c = result.data;
  const title = `${c.name} (${c.tag})`;
  const stats = [
    `Level ${c.clanLevel} clan`,
    `${c.members}/50 members`,
    c.warLeague?.name && c.warLeague.name !== "Unranked" ? c.warLeague.name : null,
    c.warWins != null ? `${fmtInt(c.warWins)} war wins` : null,
    c.location?.name,
  ].filter(Boolean);
  const description = `${stats.join(" · ")}. Members, wars, Clan War League and raid weekends for ${c.name}.`;
  const badge = c.badgeUrls.large ?? c.badgeUrls.medium;
  return {
    title,
    description,
    alternates: { canonical: clanHref(c.tag) },
    openGraph: { title, description, url: clanHref(c.tag), images: badge ? [{ url: badge, alt: `${c.name} badge` }] : undefined },
  };
}

export default function ClanLayout({ children, params }: LayoutProps<"/clan/[tag]">) {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<ClanHeaderSkeleton />}>
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
  // Tabs keep the tag the visitor asked for (the same as clan.tag with the real API).
  const urlSlug = tagToSlug(normalizeTag(slug) ?? clan.tag);
  return (
    <div className="space-y-8">
      <RecordVisit kind="clan" keyValue={clan.tag} label={clan.name} />
      <header className="space-y-5">
        <div className="flex items-center gap-4">
          <BadgeImage src={clan.badgeUrls.medium ?? clan.badgeUrls.small} alt={`${clan.name} badge`} size={64} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{clan.name}</h1>
            <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
              <span className="font-mono">{clan.tag}</span>
              <span>Level {clan.clanLevel}</span>
              <span>{clan.members}/50 members</span>
              {clan.location && <span>{clan.location.name}</span>}
            </p>
          </div>
        </div>
        <ClanNav slug={urlSlug} />
      </header>
      {children}
    </div>
  );
}

function ClanHeaderSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
