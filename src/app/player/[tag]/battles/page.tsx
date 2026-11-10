import { Suspense } from "react";
import { Section } from "@/components/stat";
import { copyArmyLink, parseArmyCode } from "@/lib/coc/army";
import { getBattleLog } from "@/lib/coc/client";
import { loadRankedGroup } from "@/lib/coc/loaders";
import type { Player } from "@/lib/coc/schemas";
import { legendTrophies, parseApiTime, rankedTrophiesForBattles } from "@/lib/coc/stats";
import { BattleLog, type BattleRow } from "../battle-log";
import { TabError, TabSkeleton, loadPlayer, tabMetadata } from "@/components/entity-tab";

export function generateMetadata({ params }: PageProps<"/player/[tag]/battles">) {
  return tabMetadata("player", params, "Battle log");
}

export default function PlayerBattlesPage({ params }: PageProps<"/player/[tag]/battles">) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Battles params={params} />
    </Suspense>
  );
}

async function Battles({ params }: Pick<PageProps<"/player/[tag]/battles">, "params">) {
  const p = await loadPlayer(params);
  if (!p) return null;
  return <BattleLogSection player={p} />;
}

async function BattleLogSection({ player }: { player: Player }) {
  const [result, group] = await Promise.all([
    getBattleLog(player.tag),
    // Same cached call as the Ranked tab; used for per-battle trophies.
    loadRankedGroup(player),
  ]);
  if (!result.ok) return <TabError error={result.error} section={{ id: "battle-log", title: "Battle log" }} />;
  const entries = result.data;
  const trophies = group?.ok
    ? rankedTrophiesForBattles(entries, group.data.attackLogs, group.data.defenseLogs)
    : entries.map(() => null);
  const rows: BattleRow[] = entries.map((entry, i) => {
    // Legend I has no group logs: estimate from stars and destruction instead.
    const legend = entry.battleType === "legend";
    const estimate = legendTrophies(entry.stars, entry.destructionPercentage);
    return {
      entry,
      whenIso: parseApiTime(entry.battleTimestamp)?.toISOString() ?? null,
      trophies: legend ? (entry.attack ? estimate : -estimate) : trophies[i],
      estimated: legend,
      army: parseArmyCode(entry.armyShareCode),
      armyLink: entry.armyShareCode ? copyArmyLink(entry.armyShareCode) : null,
    };
  });
  return (
    <Section
      id="battle-log"
      title="Battle log"
      description="Newest first. Select a battle to see the army."
    >
      {entries.length === 0 ? <p className="text-sm text-muted-foreground">No recent battles.</p> : <BattleLog rows={rows} />}
    </Section>
  );
}
