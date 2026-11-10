import { Suspense } from "react";
import { Stars } from "@/components/stars";
import { Section } from "@/components/stat";
import type { Player } from "@/lib/coc/schemas";
import { fmtInt } from "@/lib/format";
import { TabSkeleton, loadPlayer, tabMetadata } from "@/components/entity-tab";

export function generateMetadata({ params }: PageProps<"/player/[tag]/achievements">) {
  return tabMetadata("player", params, "Achievements");
}

const VILLAGE_LABEL: Record<string, string> = {
  home: "Home Village",
  builderBase: "Builder Base",
  clanCapital: "Clan Capital",
};

export default function PlayerAchievementsPage({ params }: PageProps<"/player/[tag]/achievements">) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <AchievementsTab params={params} />
    </Suspense>
  );
}

async function AchievementsTab({ params }: Pick<PageProps<"/player/[tag]/achievements">, "params">) {
  const p = await loadPlayer(params);
  if (!p) return null;
  return <Achievements player={p} />;
}

function Achievements({ player }: { player: Player }) {
  if (player.achievements.length === 0) {
    return (
      <Section title="Achievements">
        <p className="text-sm text-muted-foreground">No achievements yet.</p>
      </Section>
    );
  }
  const done = player.achievements.filter((a) => a.stars === 3).length;
  const groups = Object.groupBy(player.achievements, (a) => a.village);
  return (
    <Section title="Achievements" description={`${done} of ${player.achievements.length} completed`}>
      <div className="space-y-6">
        {Object.entries(groups).map(([village, list]) => (
          <div key={village} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{VILLAGE_LABEL[village] ?? village}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {/* Names aren't unique: the API lists some achievements twice. */}
              {list!.map((a, i) => (
                <li key={`${a.name}-${i}`} className="rounded-md border border-border bg-card px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{a.name}</span>
                    <Stars count={a.stars} className="shrink-0 text-xs" />
                  </div>
                  <p className="text-xs text-muted-foreground">{a.completionInfo ?? a.info}</p>
                  {a.stars < 3 && (
                    <p className="tabular mt-1 text-xs text-muted-foreground">
                      {fmtInt(a.value)} / {fmtInt(a.target)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
