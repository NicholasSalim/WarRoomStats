import { Suspense } from "react";
import { LevelBar } from "@/components/level-bar";
import { Section, Stat, StatGrid } from "@/components/stat";
import type { PlayerUnit } from "@/lib/coc/schemas";
import { byVillage, unitProgress } from "@/lib/coc/stats";
import { groupTroops } from "@/lib/coc/units";
import { fmtPct } from "@/lib/format";
import { TabSkeleton, loadPlayer, tabMetadata } from "@/components/entity-tab";

export function generateMetadata({ params }: PageProps<"/player/[tag]/progress">) {
  return tabMetadata("player", params, "Progress");
}

// Upgrade progress: every unit's level against its max for this Town Hall.

export default function PlayerProgressPage({ params }: PageProps<"/player/[tag]/progress">) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Progress params={params} />
    </Suspense>
  );
}

async function Progress({ params }: Pick<PageProps<"/player/[tag]/progress">, "params">) {
  const p = await loadPlayer(params);
  if (!p) return null;
  const troops = groupTroops(p.troops);
  const homeHeroes = byVillage(p.heroes, "home");
  const bbHeroes = byVillage(p.heroes, "builderBase");
  const homeSpells = byVillage(p.spells, "home");
  const equipment = p.heroEquipment.filter((e) => e.village === "home");
  const groups: Array<[string, PlayerUnit[]]> = [
    ["Heroes", homeHeroes],
    ["Hero equipment", equipment],
    ["Troops", troops.troops],
    ["Siege machines", troops.siegeMachines],
    ["Pets", troops.pets],
    ["Spells", homeSpells],
    ["Builder Base", [...bbHeroes, ...troops.builderBase]],
  ];
  return (
    <div className="space-y-12">
      <Section title="Upgrade progress" description={`Levels against the maximum for Town Hall ${p.townHallLevel}.`}>
        <StatGrid>
          {groups
            .filter(([, units]) => units.length > 0)
            .map(([label, units]) => {
              const prog = unitProgress(units);
              return (
                <Stat key={label} label={label} value={fmtPct(prog.ratio * 100)} hint={`${prog.maxed} of ${prog.count} maxed`} />
              );
            })}
        </StatGrid>
      </Section>
      <UnitSection title="Heroes" units={homeHeroes} />
      <UnitSection title="Hero equipment" units={equipment} />
      <UnitSection title="Troops" units={troops.troops} />
      <UnitSection title="Siege machines" units={troops.siegeMachines} />
      <UnitSection title="Pets" units={troops.pets} />
      <UnitSection title="Spells" units={homeSpells} />
      {troops.activeSuperTroops.length > 0 && <UnitSection title="Active super troops" units={troops.activeSuperTroops} />}
      <UnitSection title="Builder Base heroes" units={bbHeroes} />
      <UnitSection title="Builder Base troops" units={troops.builderBase} />
    </div>
  );
}

function UnitSection({ title, units }: { title: string; units: PlayerUnit[] }) {
  if (units.length === 0) return null;
  const prog = unitProgress(units);
  return (
    <Section
      title={title}
      description={`${prog.maxed} of ${prog.count} maxed for this Town Hall · ${fmtPct(prog.ratio * 100)} of levels`}
    >
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {units.map((u, i) => (
          <li key={`${u.name}-${i}`}>
            <LevelBar name={u.name} level={u.level} maxLevel={u.maxLevel} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
