import { connection } from "next/server";
import { Suspense } from "react";
import { BadgeImage } from "@/components/badge-image";
import { Stars } from "@/components/stars";
import { Section, Stat, StatGrid } from "@/components/stat";
import { Skeleton } from "@/components/ui/skeleton";
import { copyArmyLink, parseArmyCode } from "@/lib/coc/army";
import { ErrorState } from "@/components/error-state";
import { loadPlayer, tabMetadata } from "@/components/entity-tab";
import { loadRankedSeason } from "@/lib/coc/loaders";
import type { Player } from "@/lib/coc/schemas";
import {
  LEGEND_SEASON_DAYS,
  summarizeBattles,
  type RankedSeason,
  type SeasonBattle,
  type SeasonDay,
} from "@/lib/coc/season";
import { fmtDate, fmtInt, fmtPct } from "@/lib/format";
import { BattleTiles, type TileBattle } from "./battle-tiles";
import { TrophyChart, type TrophyPoint } from "./trophy-chart";

export function generateMetadata({ params }: PageProps<"/player/[tag]/season">) {
  return tabMetadata(
    "player",
    params,
    "Ranked season",
    (name) => `Day-by-day ranked attacks, defenses and trophies for ${name} this season.`,
  );
}

export default function SeasonPage({ params }: PageProps<"/player/[tag]/season">) {
  return (
    <Suspense fallback={<SeasonSkeleton />}>
      <Season params={params} />
    </Suspense>
  );
}

const DAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function signed(n: number): string {
  return n > 0 ? `+${fmtInt(n)}` : n < 0 ? `−${fmtInt(Math.abs(n))}` : "0";
}

/** The request time. "Today" decides which days exist, so the page renders per request. */
async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}

async function Season({ params }: Pick<PageProps<"/player/[tag]/season">, "params">) {
  const now = await requestTime();
  const p = await loadPlayer(params);
  if (!p) return null;
  const ranked = await loadRankedSeason(p, now);
  const allowance = ranked.kind === "unranked" ? null : ranked.allowance;
  const season = ranked.kind === "season" ? ranked.season : null;
  const error = ranked.kind === "error" ? ranked.error : null;

  return (
    <div className="space-y-10">
      <Header player={p} season={season} />
      {error && <ErrorState error={error} />}
      {!error && !season && (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {allowance ? "Not in this week's tournament group yet." : "Not in a ranked league right now."}
        </p>
      )}
      {season && <SeasonBody season={season} perDay={allowance?.period === "day" ? allowance.attacks : null} weekly={allowance?.period === "week" ? allowance.attacks : null} />}
    </div>
  );
}

function Header({ player, season }: { player: Player; season: RankedSeason | null }) {
  const tier = player.leagueTier;
  const today = season?.days.at(-1);
  const totalDays = season ? Math.round((season.endMs - season.startMs) / 86_400_000) : null;
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {tier?.iconUrls?.small && <BadgeImage src={tier.iconUrls.small} alt="" size={40} />}
        <div>
          {/* The layout's header holds the page's h1 (the player's name). */}
          <h2 className="text-2xl font-semibold tracking-tight">{tier?.name ?? "Ranked"} season</h2>
          {season && (
            <p className="text-sm text-muted-foreground">
              {fmtDate(new Date(season.startMs))} to {fmtDate(new Date(season.endMs))} · 05:00 UTC
              {today && totalDays && ` · day ${today.number} of ${totalDays}`}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

function SeasonBody({ season, perDay, weekly }: { season: RankedSeason; perDay: number | null; weekly: number | null }) {
  const days = season.days;
  const covered = days.filter((d) => d.coverage !== "missing");
  const attacks = summarizeBattles(days.flatMap((d) => d.attacks));
  const defenses = summarizeBattles(days.flatMap((d) => d.defenses));
  const today = days.at(-1);
  const firstKnown = days.find((d) => d.trophiesStart != null);
  const current = today?.trophiesEnd ?? null;
  const approx = season.estimated ? "≈" : "";
  const missingDays = days.length - covered.length;

  const chart: TrophyPoint[] = days.map((d) => ({ day: d.number, label: DAY_FMT.format(new Date(d.startMs)), trophies: d.trophiesEnd }));

  return (
    <>
      <Section
        title="Season so far"
        description={
          season.kind === "legend"
            ? missingDays > 0
              ? `${missingDays === 1 ? "Day 1 is" : `Days 1 to ${missingDays} are`} no longer available. Legend trophies are estimated from stars and destruction.`
              : "Legend trophies are estimated from stars and destruction."
            : `Weekly tournament: ${weekly} attacks for the week. League trophies start at 0, and attacks and defenses both add trophies.`
        }
      >
        <StatGrid>
          <Stat label="League trophies" value={current == null ? "–" : fmtInt(current)} hint={today?.isToday ? "now" : "end of the season"} />
          <Stat
            label="Change"
            value={current != null && firstKnown?.trophiesStart != null ? approx + signed(current - firstKnown.trophiesStart) : "–"}
            hint={firstKnown ? `since the start of day ${firstKnown.number}` : undefined}
          />
          <Stat
            label="Attacks"
            value={fmtInt(attacks.count)}
            hint={`${attacks.avgStars.toFixed(2)} ★ avg · ${approx}${signed(attacks.trophies)}${weekly ? ` · ${attacks.count}/${weekly} used` : ""}`}
          />
          <Stat
            label="Defenses"
            value={fmtInt(defenses.count)}
            hint={`${defenses.avgStars.toFixed(2)} ★ conceded · ${approx}${signed(defenses.trophies)}`}
          />
        </StatGrid>
        <div className="grid gap-3 sm:grid-cols-2">
          <StarSpread title="Attack results" summary={attacks} />
          <StarSpread title="Defense results (stars conceded)" summary={defenses} />
        </div>
      </Section>

      {covered.some((d) => d.trophiesEnd != null) && <TrophyChart data={chart} estimated={season.estimated} />}

      {season.kind === "legend" ? (
        <LegendWeeks days={days} perDay={perDay ?? 8} />
      ) : (
        <Section title="Days" description="Newest first. Days start at 05:00 UTC.">
          <DayList days={days} perDay={null} estimated={false} />
        </Section>
      )}
    </>
  );
}

function StarSpread({ title, summary }: { title: string; summary: ReturnType<typeof summarizeBattles> }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <h3 className="text-xs text-muted-foreground">{title}</h3>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
        {summary.spread.map((count, i) => (
          <div key={i}>
            <dt>
              <Stars count={3 - i} className="justify-center text-xs" />
              <span className="sr-only">{3 - i} stars</span>
            </dt>
            <dd className="tabular mt-1 text-lg font-semibold">{count}</dd>
            <dd className="tabular text-xs text-muted-foreground">{summary.count ? fmtPct((count / summary.count) * 100, 0) : "–"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LegendWeeks({ days, perDay }: { days: SeasonDay[]; perDay: number }) {
  const weeks = Array.from({ length: Math.ceil(LEGEND_SEASON_DAYS / 7) }, (_, w) => days.filter((d) => Math.ceil(d.number / 7) === w + 1)).filter(
    (w) => w.length > 0,
  );
  return (
    <div className="space-y-10">
      {weeks.reverse().map((week) => {
        const n = Math.ceil(week[0].number / 7);
        const last = week.at(-1)!;
        return (
          <Section
            key={n}
            id={`week-${n}`}
            title={`Week ${n}`}
            description={`${DAY_FMT.format(new Date(week[0].startMs))} to ${DAY_FMT.format(new Date(last.startMs))} · ${perDay} attacks and ${perDay} defenses per day`}
          >
            <DayList days={week} perDay={perDay} estimated />
          </Section>
        );
      })}
    </div>
  );
}

function DayList({ days, perDay, estimated }: { days: SeasonDay[]; perDay: number | null; estimated: boolean }) {
  return (
    <ol className="space-y-3">
      {[...days].reverse().map((d) => (
        <DayCard key={d.number} day={d} perDay={perDay} estimated={estimated} />
      ))}
    </ol>
  );
}

function toTile(b: SeasonBattle, i: number): TileBattle {
  return {
    key: `${b.whenMs}-${i}`,
    attack: b.attack,
    opponentTag: b.opponentTag,
    opponentName: b.opponentName,
    opponentTownHall: b.opponentTownHall,
    stars: b.stars,
    destruction: b.destruction,
    trophies: b.trophies,
    whenIso: new Date(b.whenMs).toISOString(),
    army: parseArmyCode(b.armyCode),
    armyLink: b.armyCode ? copyArmyLink(b.armyCode) : null,
  };
}

function DayCard({ day, perDay, estimated }: { day: SeasonDay; perDay: number | null; estimated: boolean }) {
  const change = day.trophiesStart != null && day.trophiesEnd != null ? day.trophiesEnd - day.trophiesStart : null;
  return (
    <li className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3 text-sm">
        <span className="font-medium">Day {day.number}</span>
        <span className="text-muted-foreground">{DAY_FMT.format(new Date(day.startMs))}</span>
        {day.isToday && <span className="rounded bg-muted px-1.5 text-xs">Today</span>}
        {day.coverage !== "missing" && (
          <span className="tabular ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              <span className="sr-only">Trophies at start of day: </span>
              {day.trophiesStart == null ? "?" : fmtInt(day.trophiesStart)}
            </span>
            <span aria-hidden>→</span>
            <span className="text-foreground">
              <span className="sr-only">at end of day: </span>
              {day.trophiesEnd == null ? "?" : fmtInt(day.trophiesEnd)}
            </span>
            {change != null && <span className="w-12 text-right text-sm font-medium text-foreground">{signed(change)}</span>}
          </span>
        )}
      </div>
      {day.coverage === "missing" ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">This day is no longer available.</p>
      ) : (
        <div className="space-y-3 p-4">
          {day.coverage === "partial" && (
            <p className="text-xs text-muted-foreground">Battles from earlier in this day are no longer available.</p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <BattleTiles title="Attacks" battles={day.attacks.map(toTile)} slots={perDay} estimated={estimated} />
            <BattleTiles title="Defenses" battles={day.defenses.map(toTile)} slots={perDay} estimated={estimated} />
          </div>
        </div>
      )}
    </li>
  );
}

function SeasonSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
