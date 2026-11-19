import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Lock, Users } from "lucide-react";
import { BadgeImage } from "@/components/badge-image";
import { ClanSearchBar } from "@/components/clan-search-bar";
import { ErrorState } from "@/components/error-state";
import { RecordVisit } from "@/components/recent-searches";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getClan,
  getClanLabels,
  searchClans,
} from "@/lib/coc/client";
import {
  CLAN_SEARCH_API_MAX,
  CLAN_SEARCH_PAGE_SIZE,
  parseClanSearch,
  toClanSearchItem,
  type ClanSearchItem,
} from "@/lib/coc/clan-search";
import { paginate } from "@/lib/paging";
import { Pager } from "@/components/pager";
import { fmtInt, plural, warFrequencyLabel } from "@/lib/format";
import { clanHref } from "@/lib/coc/tag";

export const metadata = { title: "Clan search", robots: { index: false } };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Clan search</h1>
        <div className="w-full sm:max-w-md">
          <Suspense fallback={<ClanSearchBar />}>
            <SearchBarWithQuery searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchBarWithQuery({
  searchParams,
}: Pick<PageProps<"/search">, "searchParams">) {
  const sp = await searchParams;
  return (
    <ClanSearchBar defaultValue={typeof sp.name === "string" ? sp.name : ""} />
  );
}

async function Results({
  searchParams,
}: Pick<PageProps<"/search">, "searchParams">) {
  const parsed = parseClanSearch(await searchParams);
  if (!parsed) {
    return (
      <EmptyState>
        Enter a clan name (at least 3 characters) or a clan tag above, or pick
        labels on the{" "}
        <Link href="/" className="underline underline-offset-4">
          home page
        </Link>
        .
      </EmptyState>
    );
  }

  if (parsed.tagOnly && parsed.tag) {
    const clan = await getClan(parsed.tag);
    if (clan.ok) redirect(clanHref(clan.data.tag));
    if (clan.error.kind !== "notFound")
      return <ErrorState error={clan.error} />;
    return (
      <EmptyState>
        No clan has the tag {parsed.tag}. Check it in-game under the clan
        profile.
      </EmptyState>
    );
  }

  const byName = parsed.params.name || parsed.params.labelIds?.length;
  const [result, exact, labels] = await Promise.all([
    byName ? searchClans(parsed.params) : null,
    // A tag-shaped query without "#" may also be a tag.
    parsed.tag ? getClan(parsed.tag) : null,
    getClanLabels(),
  ]);
  if (result && !result.ok) return <ErrorState error={result.error} />;
  const exactClan = exact?.ok ? toClanSearchItem(exact.data) : null;
  const clans = (result?.ok ? result.data : []).filter((c) => c.tag !== exactClan?.tag);
  const labelNames = (parsed.params.labelIds ?? []).map(
    (id) => (labels.ok ? labels.data.find((l) => l.id === id)?.name : undefined) ?? `#${id}`,
  );
  const what = [
    parsed.params.name ? `named “${parsed.params.name}”` : parsed.tag ? `with tag ${parsed.tag}` : null,
    labelNames.length > 0 ? `labelled ${labelNames.join(" + ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const { page, totalPages, shown, from } = paginate(clans, parsed.page, CLAN_SEARCH_PAGE_SIZE);
  const pager = <Pager path="/search" params={parsed.pagerParams} page={page} totalPages={totalPages} />;

  return (
    <>
      {byName ? <RecordVisit kind="clanSearch" keyValue={parsed.canonical} label={`Clans ${what}`} /> : null}
      {exactClan && page === 1 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Clan with the tag {exactClan.tag}</p>
          <ul className="overflow-hidden rounded-lg border border-border">
            <ClanRow c={exactClan} />
          </ul>
        </div>
      )}
      {(byName || !exactClan) && (
        <p className="text-sm text-muted-foreground">
          {clans.length === 0
            ? exactClan
              ? `No other clans ${what}.`
              : `No clans ${what} match these filters.`
            : `${fmtInt(clans.length)} ${plural(clans.length, "clan")} ${what}` +
              (totalPages > 1 ? `, showing ${fmtInt(from)}–${fmtInt(from + shown.length - 1)}` : "")}
        </p>
      )}
      {shown.length > 0 && (
        <>
          {pager}
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {shown.map((c) => (
              <ClanRow key={c.tag} c={c} />
            ))}
          </ul>
          {pager}
          {result?.ok && result.data.length >= CLAN_SEARCH_API_MAX && (
            <p className="text-xs text-muted-foreground">
              Showing the first {CLAN_SEARCH_API_MAX} matches. Add a filter or a longer name to narrow it down.
            </p>
          )}
        </>
      )}
    </>
  );
}

function ClanRow({ c }: { c: ClanSearchItem }) {
  return (
    <li>
      <Link
        href={clanHref(c.tag)}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
      >
        <BadgeImage src={c.badge} alt="" size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{c.name}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {c.tag}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>Level {c.clanLevel}</span>
            {c.location && <span>{c.location}</span>}
            {c.warLeague && <span>{c.warLeague}</span>}
            <span>Wars: {warFrequencyLabel(c.warFrequency)}</span>
            {c.isWarLogPublic === false && (
              <span className="flex items-center gap-1">
                <Lock className="size-3" aria-hidden /> Private log
              </span>
            )}
          </div>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <div className="tabular text-sm">{fmtInt(c.clanPoints)}</div>
          <div className="text-xs text-muted-foreground">trophies</div>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular">
          <Users className="size-3.5" aria-hidden />
          {c.members}/50
        </div>
      </Link>
    </li>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
