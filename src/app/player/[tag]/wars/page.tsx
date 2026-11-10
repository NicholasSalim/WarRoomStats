import Link from "next/link";
import { Suspense } from "react";
import { BadgeImage } from "@/components/badge-image";
import { ErrorState } from "@/components/error-state";
import { Section, Stat, StatGrid } from "@/components/stat";
import { Stars } from "@/components/stars";
import { getCurrentWar, getCwlWar, getLeagueGroup } from "@/lib/coc/client";
import { playerWar, warTotals, type PlayerWar, type PlayerWarAttack } from "@/lib/coc/player-activity";
import { parseApiTime, warForClan } from "@/lib/coc/stats";
import { clanHref, playerHref } from "@/lib/coc/tag";
import { fmtDate, fmtPct, seasonLabel, warStateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionSkeleton, loadPlayer, tabMetadata } from "../player-data";

export function generateMetadata({ params }: PageProps<"/player/[tag]/wars">) {
  return tabMetadata(params, "Wars");
}

// The player's clan war and CWL attacks and defenses. The API keeps these only
// inside the clan's current war and the current CWL season (the war log has
// no per-player results), so older wars aren't available.

export default function PlayerWarsPage({ params }: PageProps<"/player/[tag]/wars">) {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <Wars params={params} />
    </Suspense>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

async function Wars({ params }: Pick<PageProps<"/player/[tag]/wars">, "params">) {
  const p = await loadPlayer(params);
  if (!p) return null;
  if (!p.clan) {
    return (
      <Section title="Wars">
        <Note>Not in a clan, so there are no clan wars to show.</Note>
      </Section>
    );
  }
  const clanTag = p.clan.tag;
  const [current, group] = await Promise.all([getCurrentWar(clanTag), getLeagueGroup(clanTag)]);

  // CWL: the clan's war in each started round (each round's wars are fetched to find it).
  const cwl: PlayerWar[] = [];
  if (group.ok) {
    const rounds = await Promise.all(
      group.data.rounds.map(async (r) => {
        const results = await Promise.all(r.warTags.filter((t) => t && t !== "#0").map((t) => getCwlWar(t)));
        return results.flatMap((res) => (res.ok ? [res.data] : []));
      }),
    );
    rounds.forEach((wars, i) => {
      const ours = warForClan(wars, clanTag);
      if (!ours) return;
      const entry = playerWar(ours, p.tag, `Round ${i + 1}`, true);
      if (entry) cwl.push(entry);
    });
  }

  const regular = current.ok ? playerWar(current.data, p.tag, "Current war", false) : null;
  // During CWL the current war can be the same war as a CWL round.
  const isCwlRound = regular && cwl.some((w) => w.opponent.tag === regular.opponent.tag && w.startTime === regular.startTime);
  const currentWar = isCwlRound ? null : regular;
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
            <Stat label="Attacks used" value={`${totals.attacks}/${totals.attacksAllowed}`} hint={`in ${totals.wars} war${totals.wars === 1 ? "" : "s"}`} />
            <Stat
              label="Stars"
              value={totals.stars}
              hint={totals.attacks ? `${(totals.stars / totals.attacks).toFixed(2)} per attack · ${totals.threeStars} three-star` : undefined}
            />
            <Stat label="Avg. destruction" value={totals.attacks ? fmtPct(totals.avgDestruction) : "–"} />
            <Stat
              label="Defenses"
              value={totals.defenses}
              hint={totals.defenses ? `${(totals.starsConceded / totals.defenses).toFixed(2)} stars conceded on average` : "Not attacked yet"}
            />
          </StatGrid>
        ) : null}
      </Section>

      <Section title="Current war">
        {!current.ok ? (
          current.error.kind === "notInWar" ? (
            <Note>{p.clan.name} isn&apos;t in a war right now.</Note>
          ) : current.error.kind === "privateWarLog" ? (
            <Note>{p.clan.name}&apos;s war log is private, so its current war can&apos;t be shown.</Note>
          ) : (
            <ErrorState error={current.error} compact />
          )
        ) : isCwlRound ? (
          <Note>The current war is a Clan War League round; it&apos;s listed below.</Note>
        ) : currentWar ? (
          <WarCard war={currentWar} />
        ) : (
          <Note>{p.name} isn&apos;t in the line-up of {p.clan.name}&apos;s current war.</Note>
        )}
      </Section>

      <Section
        title="Clan War League"
        description={group.ok ? `${seasonLabel(group.data.season)} season · ${group.data.state === "ended" ? "ended" : warStateLabel(group.data.state)}` : undefined}
        action={
          group.ok ? (
            <Link href={`${clanHref(clanTag)}/cwl`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Clan&apos;s CWL page
            </Link>
          ) : null
        }
      >
        {!group.ok ? (
          group.error.kind === "cwlNotActive" ? (
            <Note>{p.clan.name} has no Clan War League season right now.</Note>
          ) : (
            <ErrorState error={group.error} compact />
          )
        ) : cwl.length === 0 ? (
          <Note>{p.name} wasn&apos;t in {p.clan.name}&apos;s line-up for any round this season.</Note>
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

const OUTCOME: Record<string, { label: string; className: string }> = {
  win: { label: "Win", className: "bg-[#0ca30c]/15 text-[#4ade80]" },
  lose: { label: "Loss", className: "bg-[#d03b3b]/15 text-[#f87171]" },
  tie: { label: "Tie", className: "bg-muted text-muted-foreground" },
};

function WarCard({ war }: { war: PlayerWar }) {
  const outcome = war.outcome ? OUTCOME[war.outcome] : null;
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
        <span className={cn("rounded px-1.5 py-0.5 text-xs", outcome ? outcome.className : "bg-muted text-muted-foreground")}>
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

