import { Suspense } from "react";
import { Section, Stat, StatGrid } from "@/components/stat";
import type { PlayerUnit } from "@/lib/coc/schemas";
import { byVillage, donationRatio, unitProgress } from "@/lib/coc/stats";
import { groupTroops } from "@/lib/coc/units";
import { fmtInt, fmtPct, fmtRatio } from "@/lib/format";
import { SectionSkeleton, loadPlayer } from "./player-data";

// Overview tab. The header and tabs live in layout.tsx; ranked, battle log,
// progress and achievements each have their own tab page.

export default function PlayerOverviewPage({ params }: PageProps<"/player/[tag]">) {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: Pick<PageProps<"/player/[tag]">, "params">) {
  const p = await loadPlayer(params);
  if (!p) return null;
  const troops = groupTroops(p.troops);
  const homeHeroes = byVillage(p.heroes, "home");
  const homeSpells = byVillage(p.spells, "home");
  return (
    <Section title="Profile">
      <StatGrid>
        <Stat label="Trophies" value={fmtInt(p.trophies)} hint={`Best ${fmtInt(p.bestTrophies)}`} />
        <Stat
          label="War stars"
          value={fmtInt(p.warStars)}
          hint={p.warPreference === "in" ? "Opted in to war" : "Opted out of war"}
        />
        <Stat label="Attack wins" value={fmtInt(p.attackWins)} hint={`${fmtInt(p.defenseWins)} defense wins this season`} />
        <Stat
          label="Donations"
          value={fmtInt(p.donations)}
          hint={`${fmtInt(p.donationsReceived)} received · ratio ${fmtRatio(donationRatio(p.donations, p.donationsReceived))}`}
        />
        <Stat label="Capital Gold contributed" value={fmtInt(p.clanCapitalContributions)} />
        <Stat
          label="Builder Base"
          value={fmtInt(p.builderBaseTrophies)}
          hint={[`BH${p.builderHallLevel ?? "–"}`, p.builderBaseLeague?.name, `best ${fmtInt(p.bestBuilderBaseTrophies)}`]
            .filter(Boolean)
            .join(" · ")}
        />
        <ProgressStat label="Heroes" units={homeHeroes} />
        <ProgressStat label="Troops & spells" units={[...troops.troops, ...troops.siegeMachines, ...homeSpells]} />
      </StatGrid>
    </Section>
  );
}

function ProgressStat({ label, units }: { label: string; units: PlayerUnit[] }) {
  const prog = unitProgress(units);
  return <Stat label={`${label} progress`} value={fmtPct(prog.ratio * 100)} hint={`${prog.maxed} of ${prog.count} maxed`} />;
}
