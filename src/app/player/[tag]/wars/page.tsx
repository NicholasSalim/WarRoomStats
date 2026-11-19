import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Suspense } from "react";
import { BadgeImage } from "@/components/badge-image";
import { Section, Stat, StatGrid } from "@/components/stat";
import { Stars } from "@/components/stars";
import { getCurrentWar } from "@/lib/coc/client";
import { roundOf, type CwlSeason } from "@/lib/coc/cwl-season";
import { loadCwlSeason } from "@/lib/coc/loaders";
import { playerWar, warTotals, type PlayerWar, type PlayerWarAttack } from "@/lib/coc/player-activity";
import { parseApiTime } from "@/lib/coc/stats";
import { clanHref, playerHref } from "@/lib/coc/tag";
import { RESULT_STYLE } from "@/lib/coc/war-outcome";
import { fmtAvg, fmtDate, fmtPct, plural, seasonLabel, warStateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/error-state";
import { TabSkeleton, loadPlayer, tabMetadata } from "@/components/entity-tab";

export function generateMetadata({ params }: PageProps<"/player/[tag]/wars">) {
  return tabMetadata("player", params, "Wars");
}

// The player's clan war and CWL attacks and defenses. The API keeps these only
// inside the clan's current war and the current CWL season (the war log has
// no per-player results), so older wars aren't available.

export default function PlayerWarsPage({ params }: PageProps<"/player/[tag]/wars">) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Wars params={params} />
    </Suspense>
  );
}

function cwlDescription(season: CwlSeason): string {
  const { group, missingWars } = season;
  const state = warStateLabel(group.state);
  const missing = missingWars > 0 ? ` · ${missingWars} ${plural(missingWars, "war")} couldn't be loaded, so this list may be incomplete` : "";
  return `${seasonLabel(group.season)} season · ${state}${missing}`;
}

async function Wars({ params }: Pick<PageProps<"/player/[tag]/wars">, "params">) {
  const p = await loadPlayer(params);
  if (!p) return null;
  if (!p.clan) {
    return (
      <Section title="Wars">
        <EmptyState>Not in a clan, so there are no clan wars to show.</EmptyState>
      </Section>
    );
  }
  const clanTag = p.clan.tag;
  const [current, season] = await Promise.all([getCurrentWar(clanTag), loadCwlSeason(clanTag)]);

  // CWL: the player's part in the clan's war of each started round.
  const rounds = season.ok
    ? season.data.ourWars.flatMap(({ round, war }) => {
        const entry = war && playerWar(war, p.tag, `Round ${round}`, true);
        return entry ? [{ round, entry }] : [];
      })
    : [];
  const cwl: PlayerWar[] = rounds.map((r) => r.entry);

  // During CWL the current war can be one of the rounds. It's then listed
  // under CWL, if the player was in that round's line-up.
  const currentRound = current.ok && season.ok ? roundOf(current.data, season.data) : null;
  const inCurrentRound = currentRound !== null && rounds.some((r) => r.round === currentRound);
  const currentWar = current.ok && currentRound === null ? playerWar(current.data, p.tag, "Current war", false) : null;
  const all = [...(currentWar ? [currentWar] : []), ...cwl];
  const totals = warTotals(all);

  return (
    <div className="space-y-12">
      <Section
        title="Wars"
        description={`${p.name}'s attacks and defenses in ${p.clan.name}'s current war and this Clan War League season.`}
      >
        {all.length > 0 ? (
          <StatGrid>
            <Stat label="Attacks used" value={`${totals.attacks}/${totals.attacksAllowed}`} hint={`in ${totals.wars} ${plural(totals.wars, "war")}`} />
            <Stat
              label="Stars"
              value={totals.stars}
              hint={totals.attacks ? `${fmtAvg(totals.stars, totals.attacks)} per attack · ${totals.threeStars} three-star` : undefined}
            />
            <Stat label="Avg. destruction" value={totals.attacks ? fmtPct(totals.avgDestruction) : "–"} />
            <Stat
              label="Defenses"
              value={totals.defenses}
              hint={totals.defenses ? `${fmtAvg(totals.starsConceded, totals.defenses)} stars conceded on average` : "Not attacked yet"}
            />
          </StatGrid>
        ) : null}
      </Section>

      <Section title="Current war">
        {!current.ok ? (
          current.error.kind === "notInWar" ? (
            <EmptyState>{p.clan.name} isn&apos;t in a war right now.</EmptyState>
          ) : current.error.kind === "privateWarLog" ? (
            <EmptyState>{p.clan.name}&apos;s war log is private, so its current war can&apos;t be shown.</EmptyState>
          ) : (
            <ErrorState error={current.error} compact />
          )
        ) : inCurrentRound ? (
          <EmptyState>The current war is Clan War League round {currentRound}, shown under Clan War League below.</EmptyState>
        ) : currentWar ? (
          <WarCard war={currentWar} />
        ) : (
          <EmptyState>{p.name} isn&apos;t in the line-up of {p.clan.name}&apos;s current war.</EmptyState>
        )}
      </Section>

      <Section
        title="Clan War League"
        description={season.ok ? cwlDescription(season.data) : undefined}
        action={
          season.ok ? (
            <Link href={`${clanHref(clanTag)}/cwl`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Clan&apos;s CWL page
            </Link>
          ) : null
        }
      >
        {!season.ok ? (
          season.error.kind === "cwlNotActive" ? (
            <EmptyState>{p.clan.name} has no Clan War League season right now.</EmptyState>
          ) : (
            <ErrorState error={season.error} compact />
          )
        ) : cwl.length === 0 ? (
          <EmptyState>{p.name} wasn&apos;t in {p.clan.name}&apos;s line-up for any round this season.</EmptyState>
        ) : (
          <div className="space-y-4">
            {cwl.map((w) => (
              <WarCard key={w.label} war={w} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function WarCard({ war }: { war: PlayerWar }) {
  const outcome = war.outcome ? RESULT_STYLE[war.outcome] : null;
  const open = war.state === "inWar" || war.state === "warEnded";
  const unused = open ? Math.max(0, war.attacksAllowed - war.attacks.length) : 0;
  const when = parseApiTime(war.startTime);
  return (
    <article className="overflow-hidden rounded-lg border border-border">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-card px-4 py-3 text-sm">
        <span className="font-medium">{war.label}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          vs
          <BadgeImage src={war.opponent.badge} alt="" size={18} />
          {war.opponent.tag ? (
            <Link href={clanHref(war.opponent.tag)} className="truncate text-foreground hover:underline">
              {war.opponent.name}
            </Link>
          ) : (
            <span className="truncate">{war.opponent.name}</span>
          )}
        </span>
        <span className={cn("rounded px-1.5 py-0.5 text-xs", outcome ? outcome.badge : RESULT_STYLE.unknown.badge)}>
          {outcome ? outcome.label : warStateLabel(war.state)}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          #{war.position} · TH{war.townHall}
          {when && ` · ${fmtDate(when)}`}
        </span>
      </header>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <AttackList
          title={`Attacks ${war.attacks.length}/${war.attacksAllowed}`}
          rows={war.attacks}
          empty={war.state === "preparation" ? "Preparation day: no attacks yet." : "No attacks used."}
          unused={unused}
          unusedLabel={war.state === "warEnded" ? "Attack missed" : "Attack left"}
        />
        <AttackList title={`Defenses ${war.defenses.length}`} rows={war.defenses} empty="Not attacked." by />
      </div>
    </article>
  );
}

function AttackList({
  title,
  rows,
  empty,
  unused = 0,
  unusedLabel = "",
  by = false,
}: {
  title: string;
  rows: PlayerWarAttack[];
  empty: string;
  unused?: number;
  unusedLabel?: string;
  /** Defenses: the row names the attacker. */
  by?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {rows.length === 0 && unused === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((a) => (
            <li key={`${a.tag}-${a.order}`} className="flex items-center gap-3">
              <Stars count={a.stars} className="shrink-0 text-xs" />
              <span className="tabular w-12 shrink-0 text-right">{fmtPct(a.destruction, 0)}</span>
              <span className="min-w-0 truncate text-muted-foreground">
                {by ? "by " : "vs "}#{a.position}{" "}
                <Link href={playerHref(a.tag)} className="text-foreground hover:underline">
                  {a.name}
                </Link>{" "}
                · TH{a.townHall}
              </span>
            </li>
          ))}
          {Array.from({ length: unused }, (_, i) => (
            <li key={`unused-${i}`} className="text-sm text-muted-foreground">
              {unusedLabel}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

