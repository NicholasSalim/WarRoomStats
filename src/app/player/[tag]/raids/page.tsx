import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Suspense } from "react";
import { ErrorState } from "@/components/error-state";
import { Section, Stat, StatGrid } from "@/components/stat";
import { Stars } from "@/components/stars";
import { getCapitalRaids } from "@/lib/coc/client";
import { playerRaids, type PlayerRaidWeekend } from "@/lib/coc/player-activity";
import { parseApiTime } from "@/lib/coc/stats";
import { clanHref } from "@/lib/coc/tag";
import { fmtDate, fmtInt, fmtPct } from "@/lib/format";
import { TabSkeleton, loadPlayer, tabMetadata } from "@/components/entity-tab";

export function generateMetadata({ params }: PageProps<"/player/[tag]/raids">) {
  return tabMetadata("player", params, "Raids");
}

// The player's Clan Capital raids, from their current clan's raid weekends.
// The API has no per-player raid history, and of the 20 weekends it keeps per
// clan, only the latest has per-player data (attacks, loot, and who attacked
// each district; checked live 2026-11-10). Older weekends are clan totals
// only, so they're on the clan's Raids tab, not here.

export default function PlayerRaidsPage({ params }: PageProps<"/player/[tag]/raids">) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Raids params={params} />
    </Suspense>
  );
}

async function Raids({ params }: Pick<PageProps<"/player/[tag]/raids">, "params">) {
  const p = await loadPlayer(params);
  if (!p) return null;
  if (!p.clan) {
    return (
      <Section title="Raid weekends">
        <EmptyState>Not in a clan, so there are no raid weekends to show.</EmptyState>
      </Section>
    );
  }
  const result = await getCapitalRaids(p.clan.tag);
  if (!result.ok) {
    return (
      <Section title="Raid weekends">
        <ErrorState error={result.error} compact />
      </Section>
    );
  }
  const weekends = playerRaids(result.data, p.tag);
  const clanRaids = `${clanHref(p.clan.tag)}/raids`;

  return (
    <Section
      title="Raid weekends"
      description={
        <>
          {p.name}&apos;s Clan Capital raids with{" "}
          <Link href={clanHref(p.clan.tag)} className="underline-offset-2 hover:underline">
            {p.clan.name}
          </Link>
          .
        </>
      }
    >
      {weekends.length === 0 ? (
        <EmptyState>{p.clan.name} has no raid weekend with player details yet.</EmptyState>
      ) : (
        weekends.map((w) => <Weekend key={w.startTime} w={w} name={p.name} />)
      )}
      <p className="text-xs text-muted-foreground">
        Earlier weekends are on{" "}
        <Link href={clanRaids} className="underline underline-offset-2 hover:text-foreground">
          {p.clan.name}&apos;s Raids tab
        </Link>
        .
      </p>
    </Section>
  );
}

function Weekend({ w, name }: { w: PlayerRaidWeekend; name: string }) {
  const raided = w.attacks != null && w.attacks > 0;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        Weekend of {fmtDate(parseApiTime(w.startTime))}
        {w.state === "ongoing" && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Live</span>}
      </h3>
      {!raided ? (
        <EmptyState>{name} didn&apos;t raid this weekend.</EmptyState>
      ) : (
        <>
          <StatGrid>
            <Stat label="Attacks" value={w.attackLimit != null ? `${w.attacks}/${w.attackLimit}` : fmtInt(w.attacks)} />
            <Stat label="Capital Gold looted" value={fmtInt(w.looted)} />
            <Stat
              label="Loot per attack"
              value={w.looted != null && w.attacks ? fmtInt(Math.round(w.looted / w.attacks)) : "–"}
            />
            <Stat label="Districts attacked" value={fmtInt(w.districtAttacks.length)} />
          </StatGrid>
          {w.districtAttacks.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-card text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Clan</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">District</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Hall</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Stars</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Destroyed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {w.districtAttacks.map((a, i) => (
                    <tr key={i}>
                      <td className="max-w-0 truncate px-3 py-2">{a.clan}</td>
                      <td className="px-3 py-2">{a.district}</td>
                      <td className="tabular px-3 py-2 text-right">{a.hallLevel}</td>
                      <td className="px-3 py-2 text-right">
                        <Stars count={a.stars} className="text-xs" />
                      </td>
                      <td className="tabular px-3 py-2 text-right">{fmtPct(a.destruction, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
