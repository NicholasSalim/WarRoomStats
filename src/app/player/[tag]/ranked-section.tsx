import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BadgeImage } from "@/components/badge-image";
import { ErrorState } from "@/components/error-state";
import { Section, Stat, StatGrid } from "@/components/stat";
import { getLeagueHistory, getLeagueTiers, getRankedGroup } from "@/lib/coc/client";
import type { LeagueTier, Player } from "@/lib/coc/schemas";
import { legendSeasonLabel } from "@/lib/coc/rankings";
import { rankedAllowance } from "@/lib/coc/stats";
import { playerHref } from "@/lib/coc/tag";
import { fmtDate, fmtInt } from "@/lib/format";

/**
 * Ranked league summary (the 2025 league rework): tier, allowance, group rank
 * and finished seasons. The current season's battles, day by day, are on the
 * season page (/player/[tag]/season), linked from here.
 */
export async function RankedSection({ player }: { player: Player }) {
  const tier = player.leagueTier;
  const allowance = rankedAllowance(tier?.id);
  const daily = allowance?.period === "day";
  const hasGroup = !!player.currentLeagueGroupTag && player.currentLeagueGroupTag !== "#0" && !!player.currentLeagueSeasonId;
  const [group, history, tiers] = await Promise.all([
    hasGroup ? getRankedGroup(player.currentLeagueGroupTag!, player.currentLeagueSeasonId!, player.tag) : null,
    getLeagueHistory(player.tag),
    getLeagueTiers(),
  ]);
  const tierById = new Map<number, LeagueTier>(tiers.ok ? tiers.data.map((t) => [t.id, t]) : []);

  const seasonHref = `${playerHref(player.tag)}/season`;
  const me = group?.ok ? group.data.members.findIndex((m) => m.playerTag === player.tag) : -1;
  const member = group?.ok && me >= 0 ? group.data.members[me] : undefined;

  const description = daily
    ? "Legend I: 8 attacks and 8 defenses per league day (05:00 to 05:00 UTC)."
    : allowance
      ? `${tier?.name}: ${allowance.attacks} attacks for the weekly tournament.`
      : "Not in a ranked league right now.";

  return (
    <Section
      id="ranked"
      title="Ranked league"
      description={description}
      action={
        allowance && (
          <Link href={seasonHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
            Season details <ChevronRight className="size-4" aria-hidden />
          </Link>
        )
      }
    >
      <StatGrid>
        <Stat
          label="League tier"
          value={
            <span className="flex items-center gap-2">
              {tier?.iconUrls?.small && <BadgeImage src={tier.iconUrls.small} alt="" size={24} />}
              {tier?.name ?? "Unranked"}
            </span>
          }
        />
        {allowance && <Stat label="Attacks allowed" value={allowance.attacks} hint={daily ? "per day, plus 8 defenses" : "per week"} />}
        {member && (
          <>
            <Stat label="League trophies" value={fmtInt(member.leagueTrophies)} hint="this season" />
            <Stat label="Group rank" value={`#${me + 1}`} hint={`of ${group?.ok ? group.data.members.length : "–"} players`} />
          </>
        )}
        <LegendStats player={player} />
      </StatGrid>

      {group && !group.ok && <ErrorState error={group.error} compact />}
      {!daily && allowance && !hasGroup && (
        <p className="text-sm text-muted-foreground">Not in this week&apos;s tournament group yet. Their battles are in the battle log below.</p>
      )}

      {(allowance || (history.ok && history.data.length > 0)) && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Past seasons</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Season end</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Tier</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Finish</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Trophies</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Attacks</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Defenses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allowance && (
                  <tr className="bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <span>In progress</span>
                        <Link href={seasonHref} className="text-xs font-medium underline-offset-2 hover:underline">
                          Details
                        </Link>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        {tier?.iconUrls?.small && <BadgeImage src={tier.iconUrls.small} alt="" size={18} />}
                        {tier?.name}
                      </span>
                    </td>
                    <td className="tabular px-3 py-2 text-right">
                      {member
                        ? `#${me + 1}`
                        : player.legendStatistics?.currentSeason?.rank
                          ? `#${fmtInt(player.legendStatistics.currentSeason.rank)}`
                          : "–"}
                    </td>
                    <td className="tabular px-3 py-2 text-right">{fmtInt(member?.leagueTrophies ?? (daily ? player.trophies : undefined))}</td>
                    <td className="tabular hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                      {member ? `${member.attackWinCount ?? 0}W ${member.attackLoseCount ?? 0}L` : "–"}
                    </td>
                    <td className="tabular hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                      {member ? `${member.defenseWinCount ?? 0}W ${member.defenseLoseCount ?? 0}L` : "–"}
                    </td>
                  </tr>
                )}
                {(history.ok ? history.data : []).map((s) => {
                  const t = s.leagueTierId != null ? tierById.get(s.leagueTierId) : undefined;
                  return (
                    <tr key={s.leagueSeasonId}>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(new Date(s.leagueSeasonId * 1000))}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          {t?.iconUrls?.small && <BadgeImage src={t.iconUrls.small} alt="" size={18} />}
                          {t?.name ?? "–"}
                        </span>
                      </td>
                      <td className="tabular px-3 py-2 text-right">{s.placement ? `#${fmtInt(s.placement)}` : "–"}</td>
                      <td className="tabular px-3 py-2 text-right">{fmtInt(s.leagueTrophies)}</td>
                      <td className="tabular hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                        {s.attackWins ?? 0}W {s.attackLosses ?? 0}L
                      </td>
                      <td className="tabular hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                        {s.defenseWins ?? 0}W {s.defenseLosses ?? 0}L
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}

/**
 * Legend stats from the player profile. The API only includes them for some
 * Legend players, and the live rank also covers players past the top 200.
 */
function LegendStats({ player }: { player: Player }) {
  const stats = player.legendStatistics;
  if (!stats) return null;
  const current = stats.currentSeason;
  const best = stats.bestSeason;
  return (
    <>
      {current?.rank != null && (
        <Stat label="Legend rank" value={`#${fmtInt(current.rank)}`} hint={`${fmtInt(current.trophies)} trophies, live`} />
      )}
      {best && (
        <Stat
          label="Best Legend season"
          value={best.rank != null ? `#${fmtInt(best.rank)}` : fmtInt(best.trophies)}
          hint={[best.rank != null ? `${fmtInt(best.trophies)} trophies` : null, best.id ? legendSeasonLabel(best.id) : null]
            .filter(Boolean)
            .join(" · ")}
        />
      )}
      {stats.legendTrophies != null && (
        <Stat label="Legend trophies" value={fmtInt(stats.legendTrophies)} hint="lifetime, from season finishes" />
      )}
    </>
  );
}
