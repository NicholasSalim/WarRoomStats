import { Suspense } from "react";
import { SeasonCountdown } from "@/components/season-countdown";
import { Section, Stat, StatGrid } from "@/components/stat";
import type { Clan } from "@/lib/coc/schemas";
import { clanTypeLabel, fmtInt, warFrequencyLabel } from "@/lib/format";
import { MembersTable } from "./members-table";
import { TabSkeleton, loadClan } from "@/components/entity-tab";

type Params = PageProps<"/clan/[tag]">["params"];

// Overview tab: clan stats and members. The header and tabs live in
// layout.tsx; wars, the war log and raid weekends each have their own tab.

export default function ClanPage({ params }: PageProps<"/clan/[tag]">) {
  return (
    <Suspense fallback={<TabSkeleton rows={8} />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: Params }) {
  const clan = await loadClan(params);
  if (!clan) return null;
  return (
    <div className="space-y-12">
      <Section title="Overview">
        {clan.description && (
          <p className="max-w-3xl text-sm whitespace-pre-line text-muted-foreground">
            {clan.description}
          </p>
        )}
        <StatGrid>
          <Stat
            label="Clan trophies"
            value={fmtInt(clan.clanPoints)}
            hint={`Builder base ${fmtInt(clan.clanBuilderBasePoints)}`}
          />
          <Stat label="War league" value={clan.warLeague?.name ?? "Unranked"} />
          <Stat
            label="War record"
            value={warRecord(clan)}
            hint={
              clan.warWinStreak ? `${clan.warWinStreak} win streak` : undefined
            }
          />
          <Stat
            label="Capital"
            value={clan.capitalLeague?.name ?? "–"}
            hint={`Hall ${clan.clanCapital?.capitalHallLevel ?? "–"} · ${fmtInt(clan.clanCapitalPoints)} trophies`}
          />
          <Stat
            label="Joining"
            value={clanTypeLabel(clan.type)}
            hint={requirements(clan)}
          />
          <Stat
            label="War frequency"
            value={warFrequencyLabel(clan.warFrequency)}
            hint={clan.isWarLogPublic ? "Public war log" : "Private war log"}
          />
          <Stat
            label="Location"
            value={clan.location?.name ?? "–"}
            hint={
              [
                clan.chatLanguage?.name,
                clan.isFamilyFriendly ? "Family friendly" : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          />
          <Stat
            label="Members"
            value={`${clan.members}/50`}
            hint={avgTownHall(clan)}
          />
        </StatGrid>
        {clan.clanCapital?.districts &&
          clan.clanCapital.districts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Clan Capital districts</h3>
              <ul
                className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
                aria-label="Clan Capital districts"
              >
                {clan.clanCapital.districts.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="truncate">
                      {d.name.replace(/\s+/g, " ")}
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      Hall {d.districtHallLevel}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        {clan.labels && clan.labels.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Clan labels">
            {clan.labels.map((l) => (
              <li
                key={l.id}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {l.name}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section
        id="members"
        title="Members"
        description={
          <>
            Select a column to sort. Donations reset each season.{" "}
            <Suspense fallback={null}>
              <SeasonCountdown inline />
            </Suspense>
          </>
        }
      >
        {clan.memberList && clan.memberList.length > 0 ? (
          <MembersTable members={clan.memberList} />
        ) : (
          <p className="text-sm text-muted-foreground">
            This clan has no members.
          </p>
        )}
      </Section>
    </div>
  );
}

function warRecord(clan: Clan): string {
  if (clan.warWins == null) return "–";
  const parts = [`${fmtInt(clan.warWins)} W`];
  if (clan.warLosses != null) parts.push(`${fmtInt(clan.warLosses)} L`);
  if (clan.warTies != null) parts.push(`${fmtInt(clan.warTies)} T`);
  return parts.join(" · ");
}

function requirements(clan: Clan): string {
  const parts = [];
  if (clan.requiredTrophies)
    parts.push(`${fmtInt(clan.requiredTrophies)}+ trophies`);
  if (clan.requiredTownhallLevel)
    parts.push(`TH${clan.requiredTownhallLevel}+`);
  if (clan.requiredBuilderBaseTrophies)
    parts.push(`${fmtInt(clan.requiredBuilderBaseTrophies)}+ Builder Base`);
  return parts.join(" · ") || "No requirements";
}

function avgTownHall(clan: Clan): string | undefined {
  const ths = (clan.memberList ?? [])
    .map((m) => m.townHallLevel)
    .filter((n): n is number => n != null);
  if (ths.length === 0) return undefined;
  return `Average TH ${(ths.reduce((a, b) => a + b, 0) / ths.length).toFixed(1)}`;
}
