import Link from "next/link";
import { Suspense } from "react";
import { BadgeImage } from "@/components/badge-image";
import { ErrorState } from "@/components/error-state";
import { Section } from "@/components/stat";
import { Skeleton } from "@/components/ui/skeleton";
import { WarView } from "@/components/war-view";
import { getCwlWar, getLeagueGroup } from "@/lib/coc/client";
import type { War } from "@/lib/coc/schemas";
import { cwlPlayerStats, cwlStandings, warForClan, warOutcome, type CwlRound } from "@/lib/coc/stats";
import { clanHref, normalizeTag, playerHref } from "@/lib/coc/tag";
import { fmtInt, fmtPct, seasonLabel, warStateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clanTabMetadata } from "../clan-data";

export function generateMetadata({ params }: PageProps<"/clan/[tag]/cwl">) {
  return clanTabMetadata(params, "Clan War League");
}

type Params = PageProps<"/clan/[tag]/cwl">["params"];

export default function CwlPage({ params, searchParams }: PageProps<"/clan/[tag]/cwl">) {
  return (
    <Suspense fallback={<CwlSkeleton />}>
      <Cwl params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Cwl({ params, searchParams }: { params: Params; searchParams: PageProps<"/clan/[tag]/cwl">["searchParams"] }) {
  const [{ tag: slug }, sp] = await Promise.all([params, searchParams]);
  const clanTag = normalizeTag(slug);
  const groupResult = await getLeagueGroup(slug);
  if (!clanTag || !groupResult.ok) {
    if (!groupResult.ok && (groupResult.error.kind === "notFound" || groupResult.error.kind === "invalidTag")) return null;
    return groupResult.ok ? null : <ErrorState error={groupResult.error} />;
  }
  const group = groupResult.data;

  // Every war of every started round: needed for the full group standings.
  const rounds: CwlRound[] = await Promise.all(
    group.rounds.map(async (r, i) => {
      const tags = r.warTags.filter((t) => t && t !== "#0");
      const results = await Promise.all(tags.map((t) => getCwlWar(t)));
      return { round: i + 1, wars: results.flatMap((res) => (res.ok ? [res.data] : [])) };
    }),
  );
  const ourWars = rounds.map((r) => ({ round: r.round, war: warForClan(r.wars, clanTag) }));
  const standings = cwlStandings(group, rounds);
  const players = cwlPlayerStats(clanTag, rounds);

  const started = ourWars.filter((w) => w.war);
  const requested = Number(typeof sp.round === "string" ? sp.round : NaN);
  const selected =
    ourWars.find((w) => w.round === requested && w.war) ??
    [...started].reverse().find((w) => w.war?.state === "inWar") ??
    started.at(-1);

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{seasonLabel(group.season)} season</h2>
        <span className="text-sm text-muted-foreground">{group.state === "ended" ? "Season ended" : warStateLabel(group.state)}</span>
      </div>

      <Section title="Group standings" description="Stars plus 10 for each war won. Ties go to total destruction.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="w-10 px-3 py-2 text-right font-medium">#</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Clan</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Points</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Stars</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Destruction</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">W-L-T</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {standings.map((row, i) => (
                <tr key={row.tag} className={cn(row.tag === clanTag && "bg-muted/60")}>
                  <td className="tabular px-3 py-2 text-right text-muted-foreground">{i + 1}</td>
                  <td className="max-w-0 px-3 py-2">
                    <Link href={clanHref(row.tag)} className="flex items-center gap-2 hover:underline">
                      <BadgeImage src={row.badge} alt="" size={20} />
                      <span className="truncate">{row.name}</span>
                    </Link>
                  </td>
                  <td className="tabular px-3 py-2 text-right font-medium">{row.points}</td>
                  <td className="tabular hidden px-3 py-2 text-right sm:table-cell">{row.stars}</td>
                  <td className="tabular px-3 py-2 text-right">{fmtPct(row.destruction, 0)}</td>
                  <td className="tabular px-3 py-2 text-right text-muted-foreground">
                    {row.wins}-{row.losses}-{row.ties}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Rounds">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {ourWars.map(({ round, war }) => (
            <li key={round}>
              <RoundCard round={round} war={war} slug={clanTag.slice(1)} selected={selected?.round === round} />
            </li>
          ))}
        </ol>
        {selected?.war && (
          <div className="pt-4">
            <h3 className="mb-4 font-semibold tracking-tight">Round {selected.round}</h3>
            <WarView war={selected.war} />
          </div>
        )}
      </Section>

      <Section title="Player stats" description="This clan's attacks across the season so far.">
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attacks yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Player</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">TH</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Stars</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Attacks</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">3★</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Avg. ★</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">Avg. %</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">Missed</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-medium lg:table-cell">★ conceded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {players.map((p) => (
                  <tr key={p.tag}>
                    <td className="max-w-0 px-3 py-2">
                      <Link href={playerHref(p.tag)} className="block truncate hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="tabular px-3 py-2 text-right">{p.townhallLevel}</td>
                    <td className="tabular px-3 py-2 text-right font-medium">{p.stars}</td>
                    <td className="tabular px-3 py-2 text-right">
                      {p.attacks}/{p.warsIn}
                    </td>
                    <td className="tabular hidden px-3 py-2 text-right sm:table-cell">{p.triples}</td>
                    <td className="tabular hidden px-3 py-2 text-right sm:table-cell">{p.avgStars.toFixed(2)}</td>
                    <td className="tabular hidden px-3 py-2 text-right md:table-cell">{fmtPct(p.avgDestruction, 0)}</td>
                    <td className={cn("tabular hidden px-3 py-2 text-right md:table-cell", p.missed > 0 ? "text-foreground" : "text-muted-foreground")}>
                      {p.missed}
                    </td>
                    <td className="tabular hidden px-3 py-2 text-right text-muted-foreground lg:table-cell">
                      {fmtInt(p.starsConceded)}/{p.defenses}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function RoundCard({ round, war, slug, selected }: { round: number; war: War | null; slug: string; selected: boolean }) {
  const body = (
    <>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Round {round}</span>
        {war && <span>{war.state === "warEnded" ? resultLabel(war) : warStateLabel(war.state)}</span>}
      </div>
      {war ? (
        <>
          <p className="mt-1 truncate text-sm">vs {war.opponent?.name}</p>
          <p className="tabular text-sm font-medium">
            {war.clan?.stars ?? 0} – {war.opponent?.stars ?? 0} ★
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Not started</p>
      )}
    </>
  );
  const className = cn(
    "block h-full rounded-lg border px-3 py-2 transition-colors",
    selected ? "border-foreground bg-muted" : "border-border",
    war && !selected && "hover:bg-muted",
  );
  if (!war) return <div className={className}>{body}</div>;
  return (
    <Link href={`/clan/${slug}/cwl?round=${round}`} scroll={false} aria-current={selected ? "true" : undefined} className={className}>
      {body}
    </Link>
  );
}

function resultLabel(war: War): string {
  const o = warOutcome(war.clan, war.opponent);
  return o === "win" ? "Won" : o === "lose" ? "Lost" : "Draw";
}

function CwlSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-80 w-full" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}
