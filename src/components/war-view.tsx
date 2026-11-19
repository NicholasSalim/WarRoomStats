import Link from "next/link";
import { BadgeImage } from "@/components/badge-image";
import { RelativeTime } from "@/components/relative-time";
import { Stars } from "@/components/stars";
import type { War, WarClan } from "@/lib/coc/schemas";
import { parseApiTime, warMemberRows, warSideSummary, type WarMemberRow } from "@/lib/coc/stats";
import { RESULT_STYLE, endedWarOutcome } from "@/lib/coc/war-outcome";
import { clanHref, playerHref } from "@/lib/coc/tag";
import { fmtAvg, fmtPct, warStateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Scoreboard + both line-ups for a regular or CWL war. `war.clan` is "our" side. */
export function WarView({ war, linkClans = true }: { war: War; linkClans?: boolean }) {
  const prep = parseApiTime(war.startTime);
  const end = parseApiTime(war.endTime);
  const ours = warSideSummary(war, "clan");
  const theirs = warSideSummary(war, "opponent");
  const outcome = endedWarOutcome(war);
  // Map position of every base, to show attack targets as "#5".
  const positions = new Map(
    [...(war.clan?.members ?? []), ...(war.opponent?.members ?? [])].map((m) => [m.tag, m.mapPosition]),
  );

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">{warStateLabel(war.state)}</span>
          <span className="text-muted-foreground">
            {war.state === "preparation" && prep && (
              <>
                Battle starts <RelativeTime iso={prep.toISOString()} />
              </>
            )}
            {war.state === "inWar" && end && (
              <>
                Ends <RelativeTime iso={end.toISOString()} />
              </>
            )}
            {war.state === "warEnded" && end && (
              <>
                Ended <RelativeTime iso={end.toISOString()} />
              </>
            )}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <ClanSide side={war.clan} align="left" link={linkClans} />
          <div className="text-center">
            <div className="tabular text-3xl font-semibold tracking-tight sm:text-4xl">
              {war.clan?.stars ?? 0}
              <span className="mx-2 text-muted-foreground">–</span>
              {war.opponent?.stars ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {war.teamSize} v {war.teamSize}
              {outcome && ` · ${RESULT_STYLE[outcome].label}`}
            </div>
          </div>
          <ClanSide side={war.opponent} align="right" link={linkClans} />
        </div>
        <dl className="mt-6 grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-2 text-sm">
          <CompareRow label="Destruction" left={fmtPct(war.clan?.destructionPercentage, 2)} right={fmtPct(war.opponent?.destructionPercentage, 2)} />
          <CompareRow label="Attacks" left={`${ours.attacksUsed}/${ours.attacksAllowed}`} right={`${theirs.attacksUsed}/${theirs.attacksAllowed}`} />
          <CompareRow label="Three stars" left={String(ours.triples)} right={String(theirs.triples)} />
          <CompareRow
            label="Avg. stars"
            left={fmtAvg(ours.attackStars, ours.attacksUsed)}
            right={fmtAvg(theirs.attackStars, theirs.attacksUsed)}
          />
        </dl>
      </div>

      {war.state === "preparation" ? (
        <p className="text-sm text-muted-foreground">Attacks open when battle day starts.</p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <Lineup title={war.clan?.name ?? "Clan"} rows={warMemberRows(war, "clan")} positions={positions} />
        <Lineup title={war.opponent?.name ?? "Opponent"} rows={warMemberRows(war, "opponent")} positions={positions} />
      </div>
    </div>
  );
}

function ClanSide({ side, align, link }: { side: WarClan | undefined; align: "left" | "right"; link: boolean }) {
  const name = side?.name ?? "Unknown";
  return (
    <div className={cn("flex min-w-0 items-center gap-3", align === "right" && "flex-row-reverse text-right")}>
      <BadgeImage src={side?.badgeUrls?.medium ?? side?.badgeUrls?.small} alt="" size={48} className="hidden sm:block" />
      <div className="min-w-0">
        {link && side?.tag ? (
          <Link href={clanHref(side.tag)} className="block truncate font-medium hover:underline">
            {name}
          </Link>
        ) : (
          <span className="block truncate font-medium">{name}</span>
        )}
        <span className="font-mono text-xs text-muted-foreground">{side?.tag}</span>
      </div>
    </div>
  );
}

function CompareRow({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <>
      <dd className="tabular text-left">{left}</dd>
      <dt className="text-center text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular text-right">{right}</dd>
    </>
  );
}

function Lineup({ title, rows, positions }: { title: string; rows: WarMemberRow[]; positions: Map<string, number> }) {
  return (
    <section className="space-y-3" aria-label={`${title} line-up`}>
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {rows.map((r) => (
          <li key={r.tag} className="grid grid-cols-[2rem_1fr_auto] items-start gap-2 px-3 py-2 text-sm">
            <span className="tabular pt-0.5 text-right text-muted-foreground">{r.mapPosition}</span>
            <div className="min-w-0">
              <Link href={playerHref(r.tag)} className="block truncate font-medium hover:underline">
                {r.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                TH{r.townhallLevel}
                {r.defenseStars != null ? (
                  <>
                    {" · "}defended: <Stars count={r.defenseStars} className="text-[11px]" /> {fmtPct(r.defenseDestruction, 0)}
                  </>
                ) : (
                  " · not attacked"
                )}
              </span>
            </div>
            <LineupAttacks row={r} positions={positions} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A line-up member's attacks as compact "→ #5 ★★ 87%" rows, padded with unused attacks. */
function LineupAttacks({ row, positions }: { row: WarMemberRow; positions: Map<string, number> }) {
  const attacks = row.attacks;
  const missing = Math.max(0, row.attacksAllowed - attacks.length);
  return (
    <ul className="flex flex-col items-end gap-0.5 text-xs">
      {attacks.map((a) => (
        <li key={a.order} className="flex items-center gap-2">
          <span className="text-muted-foreground">→ #{positions.get(a.defenderTag) ?? "?"}</span>
          <Stars count={a.stars} />
          <span className="tabular w-10 text-right">{fmtPct(a.destructionPercentage, 0)}</span>
        </li>
      ))}
      {Array.from({ length: missing }, (_, i) => (
        <li key={`m${i}`} className="text-muted-foreground/60">
          attack unused
        </li>
      ))}
    </ul>
  );
}
