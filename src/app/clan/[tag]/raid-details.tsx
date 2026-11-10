import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BadgeImage } from "@/components/badge-image";
import { Stars } from "@/components/stars";
import { weekendRaiders } from "@/lib/coc/player-activity";
import type { CapitalRaidSeason, RaidDistrict } from "@/lib/coc/schemas";
import { parseApiTime } from "@/lib/coc/stats";
import { clanHref, playerHref } from "@/lib/coc/tag";
import { fmtCompact, fmtDate, fmtInt, fmtPct } from "@/lib/format";

// One raid weekend in detail: the clan's raiders (members list), the clans
// it raided (attackLog) and the clans that raided it (defenseLog). Clans and
// districts expand with native <details>, no JS.

interface RaidRow {
  clan: {
    tag: string;
    name: string;
    level?: number;
    badgeUrls?: { small?: string };
  };
  attackCount: number;
  districtCount: number;
  districtsDestroyed: number;
  districts: RaidDistrict[];
}

/** One weekend: its raiders, the clans raided and the defenses. */
export function RaidDetails({ season: s }: { season: CapitalRaidSeason }) {
  return (
    <div className="space-y-6 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium">
          Weekend of {fmtDate(parseApiTime(s.startTime))}
        </h3>
        <span className="text-xs text-muted-foreground">
          {s.members?.length ?? 0} raiders · {s.attackLog.length} raided ·{" "}
          {s.defenseLog.length} defended
        </span>
      </div>
      <Raiders season={s} />
      <div className="grid gap-6 lg:grid-cols-2">
        <RaidList
          title="Our raids"
          empty="No raids this weekend."
          rows={s.attackLog.map((r) => ({ ...r, clan: r.defender }))}
          attackerNames
        />
        <RaidList
          title="Defenses"
          empty="Nobody raided this clan."
          rows={s.defenseLog.map((r) => ({ ...r, clan: r.attacker }))}
        />
      </div>
    </div>
  );
}

function RaidList({
  title,
  rows,
  empty,
  attackerNames = false,
}: {
  title: string;
  rows: RaidRow[];
  empty: string;
  /** Our raids list who attacked each district; for defenses those are the other clan's players. */
  attackerNames?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((r, i) => (
            <li key={`${r.clan.tag}-${i}`}>
              <details className="group/clan">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/clan:rotate-90"
                    aria-hidden
                  />
                  <BadgeImage src={r.clan.badgeUrls?.small} alt="" size={20} />
                  <span className="min-w-0 flex-1 truncate">{r.clan.name}</span>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {r.districtsDestroyed}/{r.districtCount} districts ·{" "}
                    {r.attackCount} attacks
                  </span>
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  <Link
                    href={clanHref(r.clan.tag)}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Open {r.clan.name}
                    {r.clan.level != null && ` (level ${r.clan.level})`}
                  </Link>
                  <DistrictTable
                    districts={r.districts}
                    attackerNames={attackerNames}
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DistrictTable({
  districts,
  attackerNames,
}: {
  districts: RaidDistrict[];
  attackerNames: boolean;
}) {
  if (districts.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 pr-2 text-left font-medium">
              District
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              Hall
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              Destroyed
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              Attacks
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">
              Loot
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {districts.map((d) => (
            <tr key={d.id} className="align-top">
              <td className="py-1.5 pr-2">
                <span className="flex items-center gap-1.5">
                  {d.name}
                  {d.stars != null && d.stars > 0 && (
                    <Stars count={d.stars} className="text-[10px]" />
                  )}
                </span>
                {attackerNames && d.attacks && d.attacks.length > 0 && (
                  <span className="block text-muted-foreground">
                    {d.attacks
                      .map(
                        (a) =>
                          `${a.attacker.name} ${fmtPct(a.destructionPercent, 0)}`,
                      )
                      .join(", ")}
                  </span>
                )}
              </td>
              <td className="tabular px-2 py-1.5 text-right">
                {d.districtHallLevel}
              </td>
              <td className="tabular px-2 py-1.5 text-right">
                {fmtPct(d.destructionPercent, 0)}
              </td>
              <td className="tabular px-2 py-1.5 text-right">
                {fmtInt(d.attackCount)}
              </td>
              <td className="tabular py-1.5 pl-2 text-right">
                {fmtCompact(d.totalLooted)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The weekend's raiders, most Capital Gold looted first. */
function Raiders({ season }: { season: CapitalRaidSeason }) {
  const raiders = weekendRaiders(season);
  if (raiders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Raiders aren&apos;t available for this weekend.
      </p>
    );
  }
  const withLoot = raiders.some((r) => r.looted != null);
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">
        Raiders ({raiders.length})
      </h4>
      <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {raiders.map((m, i) => (
          <li
            key={m.tag}
            className="flex items-center gap-3 border-b border-border py-1.5"
          >
            <span className="tabular w-6 text-right text-xs text-muted-foreground">
              {i + 1}
            </span>
            <Link
              href={playerHref(m.tag)}
              className="min-w-0 flex-1 truncate hover:underline"
            >
              {m.name}
            </Link>
            <span className="tabular text-xs text-muted-foreground">
              {m.attackLimit != null
                ? `${m.attacks}/${m.attackLimit}`
                : m.attacks}{" "}
              attack{m.attacks === 1 && m.attackLimit == null ? "" : "s"}
            </span>
            {withLoot && (
              <span className="tabular w-16 text-right">
                {fmtCompact(m.looted)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
