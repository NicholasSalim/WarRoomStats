"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDown, Shield, Swords } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Stars } from "@/components/stars";
import { ArmyView } from "@/components/army-view";
import type { Army } from "@/lib/coc/army";
import type { BattleLogEntry } from "@/lib/coc/schemas";
import { playerHref } from "@/lib/coc/tag";
import { battleTypeLabel, fmtDuration, fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface BattleRow {
  entry: BattleLogEntry;
  /** ISO time of the battle (parsed on the server). */
  whenIso: string | null;
  /**
   * The player's trophy change: exact from the weekly group logs (defenses earn
   * trophies there), estimated for Legend I (defenses lose them). Null if unknown.
   */
  trophies: number | null;
  /** True when `trophies` is a Legend I estimate, not a reported value. */
  estimated: boolean;
  army: Army | null;
  /** Official in-game "copy army" link, when the battle has an army code. */
  armyLink: string | null;
}

type Group = "ranked" | "regular" | "other";
type Side = "all" | "attacks" | "defenses";

const GROUP_LABEL: Record<Group, string> = { ranked: "Ranked", regular: "Regular", other: "Other" };

/** Ranked and Legend battles move league trophies; Regular is multiplayer farming. */
function groupOf(battleType: string): Group {
  if (battleType === "ranked" || battleType === "legend") return "ranked";
  if (battleType === "homeVillage") return "regular";
  return "other";
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

/** Recent battles, split by type (ranked vs regular) with expandable rows. */
export function BattleLog({ rows }: { rows: BattleRow[] }) {
  const groups = (["ranked", "regular", "other"] as const).filter((g) => rows.some((r) => groupOf(r.entry.battleType) === g));
  const [group, setGroup] = useState<Group>(groups[0] ?? "ranked");
  const [side, setSide] = useState<Side>("all");
  const [open, setOpen] = useState<number | null>(null);

  const inGroup = rows.filter((r) => groupOf(r.entry.battleType) === group);
  const shown = inGroup.filter((r) => (side === "all" ? true : side === "attacks" ? r.entry.attack : !r.entry.attack));
  const atk = inGroup.filter((r) => r.entry.attack);
  const def = inGroup.filter((r) => !r.entry.attack);
  const avg = (list: BattleRow[]) => (list.length ? (list.reduce((s, r) => s + r.entry.stars, 0) / list.length).toFixed(2) : "–");
  const known = inGroup.filter((r) => r.trophies != null);
  const sum = (list: BattleRow[]) => list.reduce((s, r) => s + (r.trophies ?? 0), 0);
  const fromAttacks = sum(known.filter((r) => r.entry.attack));
  const fromDefenses = sum(known.filter((r) => !r.entry.attack));
  const approx = known.some((r) => r.estimated) ? "≈" : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Battle type" className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={group === g}
              onClick={() => {
                setGroup(g);
                setOpen(null);
              }}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                group === g ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {GROUP_LABEL[g]}{" "}
              <span className="tabular text-xs text-muted-foreground">
                {rows.filter((r) => groupOf(r.entry.battleType) === g).length}
              </span>
            </button>
          ))}
        </div>
        <div role="group" aria-label="Attacks or defenses" className="inline-flex rounded-lg border border-border p-0.5 text-xs">
          {(["all", "attacks", "defenses"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={side === s}
              onClick={() => {
                setSide(s);
                setOpen(null);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 capitalize transition-colors",
                side === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Attacks" value={String(atk.length)} hint={`avg ${avg(atk)} ★`} />
        <Tile label="Defenses" value={String(def.length)} hint={`avg ${avg(def)} ★ conceded`} />
        {group === "ranked" && known.length > 0 ? (
          <>
            <Tile label="From attacks" value={approx + signed(fromAttacks)} hint={`${known.filter((r) => r.entry.attack).length} attacks`} />
            <Tile label="Net trophies" value={approx + signed(fromAttacks + fromDefenses)} hint={`${signed(fromDefenses)} from defenses`} />
          </>
        ) : (
          <>
            <Tile label="Three-star attacks" value={String(atk.filter((r) => r.entry.stars === 3).length)} />
            <Tile label="Three-starred" value={String(def.filter((r) => r.entry.stars === 3).length)} hint="on defense" />
          </>
        )}
      </dl>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No {side === "all" ? "" : side} {GROUP_LABEL[group].toLowerCase()} battles in the recent log.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {shown.map((r) => {
            const key = rows.indexOf(r);
            return <BattleItem key={key} row={r} open={open === key} onToggle={() => setOpen(open === key ? null : key)} showTrophies={group === "ranked"} />;
          })}
        </ul>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 text-xl font-semibold tracking-tight">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function BattleItem({ row, open, onToggle, showTrophies }: { row: BattleRow; open: boolean; onToggle: () => void; showTrophies: boolean }) {
  const panelId = useId();
  const e = row.entry;
  const Icon = e.attack ? Swords : Shield;
  return (
    <li className={cn(open && "bg-muted/40")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
      >
        <Icon className={cn("size-4 shrink-0", e.attack ? "text-foreground" : "text-muted-foreground")} aria-label={e.attack ? "Attack" : "Defense"} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">{e.attack ? "vs" : "by"}</span>
            <span className="truncate font-medium">{e.opponentName}</span>
            {e.opponentTownHallLevel != null && <span className="shrink-0 text-xs text-muted-foreground">TH{e.opponentTownHallLevel}</span>}
          </span>
          <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            {e.battleType === "legend" && <span className="rounded bg-muted px-1">Legend</span>}
            {row.whenIso && <RelativeTime iso={row.whenIso} />}
          </span>
        </span>
        <Stars count={e.stars} className="shrink-0" />
        <span className="tabular w-10 shrink-0 text-right">{fmtPct(e.destructionPercentage, 0)}</span>
        {showTrophies && (
          <span className={cn("tabular w-10 shrink-0 text-right", row.trophies != null && row.trophies < 0 && "text-muted-foreground")}>
            {row.trophies == null ? "–" : (row.estimated ? "≈" : "") + signed(row.trophies)}
          </span>
        )}
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id={panelId} className="grid gap-5 border-t border-border px-4 py-4 text-sm md:grid-cols-[minmax(0,14rem)_minmax(0,12rem)_1fr]">
          <BattleFacts row={row} />
          <Loot entry={e} />
          <ArmyView army={row.army} armyLink={row.armyLink} attack={row.entry.attack} opponentName={row.entry.opponentName} />
        </div>
      )}
    </li>
  );
}

function BattleFacts({ row }: { row: BattleRow }) {
  const e = row.entry;
  return (
    <div className="space-y-2">
      <div>
        <Link href={playerHref(e.opponentPlayerTag)} className="font-medium hover:underline">
          {e.opponentName}
        </Link>
        <p className="font-mono text-xs text-muted-foreground">{e.opponentPlayerTag}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Result</dt>
        <dd className="flex items-center gap-2">
          <Stars count={e.stars} /> {fmtPct(e.destructionPercentage, 0)}
        </dd>
        <dt className="text-muted-foreground">Type</dt>
        <dd>{battleTypeLabel(e.battleType)} {e.attack ? "attack" : "defense"}</dd>
        <dt className="text-muted-foreground">Duration</dt>
        <dd>{fmtDuration(e.battleTime)}</dd>
        {row.trophies != null && (
          <>
            <dt className="text-muted-foreground">Trophies</dt>
            <dd className="tabular">
              {row.estimated ? "≈" : ""}
              {signed(row.trophies)}
              {row.estimated && <span className="text-muted-foreground"> (estimated)</span>}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

// Identity colours for the three resources, used only as a small marker beside the text.
const RESOURCES = [
  { key: "Gold", label: "Gold", color: "#f5c518" },
  { key: "Elixir", label: "Elixir", color: "#d946ef" },
  { key: "DarkElixir", label: "Dark Elixir", color: "#7c5c99" },
] as const;

function Loot({ entry }: { entry: BattleLogEntry }) {
  const amounts = RESOURCES.map((r) => ({ ...r, amount: entry.lootedResources?.find((x) => x.name === r.key)?.amount ?? 0 }));
  return (
    <div className="space-y-2">
      <h4 className="text-xs text-muted-foreground">{entry.attack ? "Loot" : "Resources lost"}</h4>
      <ul className="space-y-1.5">
        {amounts.map((r) => (
          <li key={r.key} className="border-b-2 pb-1" style={{ borderColor: r.color }}>
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className="tabular font-medium">{fmtInt(r.amount)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

