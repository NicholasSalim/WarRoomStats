import Link from "next/link";
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
  type ClanSearchParams,
} from "@/lib/coc/client";
import { CLAN_SEARCH_API_MAX, CLAN_SEARCH_PAGE_SIZE, toClanSearchItem, type ClanSearchItem } from "@/lib/coc/clan-search";
import { pageCount, pageSlice, parsePage } from "@/lib/coc/rankings";
import { Pager } from "@/components/pager";
import { fmtInt, warFrequencyLabel } from "@/lib/format";
import { clanHref, normalizeTag } from "@/lib/coc/tag";

export const metadata = { title: "Clan search", robots: { index: false } };

const WAR_FREQUENCIES = new Set([
  "always",
  "moreThanOncePerWeek",
  "oncePerWeek",
  "lessThanOncePerWeek",
  "never",
]);

function intParam(
  v: string | string[] | undefined,
  min: number,
  max: number,
): number | undefined {
  if (typeof v !== "string" || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}

/** Clans carry at most 3 labels, so more can never match (see search-panel.tsx). */
const MAX_LABELS = 3;

function labelParam(v: string | string[] | undefined): number[] {
  const raw = (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) =>
    x.split(","),
  );
  const ids = raw.filter((x) => /^56\d{6}$/.test(x)).map(Number);
  return [...new Set(ids)].slice(0, MAX_LABELS);
}

interface ParsedSearch {
  params: ClanSearchParams;
  canonical: string;
  /** The query read as a clan tag, when it has a tag's shape. */
  tag: string | null;
  /** The query started with "#": it's only a tag, never a name. */
  tagOnly: boolean;
  /** What the visitor typed, for the search bar. */
  query: string;
  /** The search params that identify this search (everything but the page). */
  pagerParams: Record<string, string>;
  page: number;
}

/**
 * Validates search params. The `name` box takes a clan name or a clan tag:
 * "#2PRGP0L22" is only a tag; "2PRGP0L22" is tried as both (names can use
 * the same letters). Needs a name, a tag or a label.
 */
function parseSearch(
  sp: Record<string, string | string[] | undefined>,
): ParsedSearch | null {
  const query = typeof sp.name === "string" ? sp.name.trim().replace(/\s+/g, " ").slice(0, 50) : "";
  const tag = normalizeTag(query);
  const tagOnly = query.startsWith("#") || query.startsWith("%23");
  const name = !tagOnly && query.length >= 3 ? query : undefined;
  const labelIds = labelParam(sp.labelIds);
  if (!name && !tag && labelIds.length === 0) return null;
  const params: ClanSearchParams = {
    name,
    labelIds,
    warFrequency:
      typeof sp.warFrequency === "string" &&
      WAR_FREQUENCIES.has(sp.warFrequency)
        ? sp.warFrequency
        : undefined,
    locationId: intParam(sp.locationId, 32000000, 32999999),
    minMembers: intParam(sp.minMembers, 2, 50),
    minClanLevel: intParam(sp.minClanLevel, 2, 50),
  };
  const q = new URLSearchParams();
  if (name) q.set("name", name);
  if (labelIds.length > 0) q.set("labelIds", labelIds.join(","));
  for (const key of [
    "warFrequency",
    "locationId",
    "minMembers",
    "minClanLevel",
  ] as const) {
    if (params[key] != null) q.set(key, String(params[key]));
  }
  return {
    params,
    canonical: q.toString(),
    tag,
    tagOnly: tagOnly && !!tag,
    query,
    // Keep what was typed (a tag-shaped name too), so every page repeats the same search.
    pagerParams: Object.fromEntries([...(query ? [["name", query]] : []), ...[...q].filter(([k]) => k !== "name")]),
    page: parsePage(sp.page),
  };
}

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
  const parsed = parseSearch(await searchParams);
  if (!parsed) {
    return (
      <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        Enter a clan name (at least 3 characters) or a clan tag above, or pick
        labels on the{" "}
        <Link href="/" className="underline underline-offset-4">
          home page
        </Link>
        .
      </p>
    );
  }

  // "#TAG": go straight to the clan.
  if (parsed.tagOnly && parsed.tag) {
    const clan = await getClan(parsed.tag);
    if (clan.ok) redirect(clanHref(clan.data.tag));
    if (clan.error.kind !== "notFound")
      return <ErrorState error={clan.error} />;
    return (
      <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        No clan has the tag {parsed.tag}. Check it in-game under the clan
        profile.
      </p>
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

  const totalPages = pageCount(clans.length, CLAN_SEARCH_PAGE_SIZE);
  const page = Math.min(parsed.page, totalPages);
  const shown = pageSlice(clans, page, CLAN_SEARCH_PAGE_SIZE);
  const from = (page - 1) * CLAN_SEARCH_PAGE_SIZE + 1;
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
            : `${fmtInt(clans.length)} clan${clans.length === 1 ? "" : "s"} ${what}` +
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
