"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArmyView } from "@/components/army-view";
import { Stars } from "@/components/stars";
import type { Army } from "@/lib/coc/army";
import { playerHref } from "@/lib/coc/tag";
import { fmtAvg, fmtSigned } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One battle on the season page, prepared on the server (army already decoded). */
export interface TileBattle {
  key: string;
  attack: boolean;
  opponentTag: string;
  opponentName: string;
  opponentTownHall: number | null;
  stars: number;
  destruction: number;
  trophies: number;
  whenIso: string;
  army: Army | null;
  armyLink: string | null;
}

const TIME_FMT = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * A day's attacks or defenses as tiles (trophies + stars), with dashed empty
 * slots up to the allowance. Selecting a tile opens the battle below the grid,
 * with the army used, like the battle log.
 */
export function BattleTiles({
  title,
  battles,
  slots,
  estimated,
}: {
  title: string;
  battles: TileBattle[];
  slots: number | null;
  estimated: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const panelId = useId();
  const selected = battles.find((b) => b.key === open) ?? null;
  const empty = slots != null ? Math.max(0, slots - battles.length) : 0;
  const total = battles.reduce((s, b) => s + b.trophies, 0);
  const stars = battles.reduce((s, b) => s + b.stars, 0);

  return (
    <div className="space-y-2">
      <h3 className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {title}{" "}
          <span className="tabular">
            {battles.length}
            {slots != null && `/${slots}`}
          </span>
        </span>
        {battles.length > 0 && (
          <span className="tabular">
            {fmtAvg(stars, battles.length)} ★ · <span className="text-foreground">{fmtSigned(total)}</span>
          </span>
        )}
      </h3>
      {battles.length === 0 && empty === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {battles.map((b) => {
            const isOpen = open === b.key;
            return (
              <li key={b.key}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : b.key)}
                  title={`${b.opponentName} · ${b.stars}★ ${b.destruction}%`}
                  className={cn(
                    "flex w-full flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 transition-colors",
                    isOpen ? "border-foreground/60 bg-muted" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <span className={cn("tabular text-xs font-semibold", b.trophies <= 0 && "text-muted-foreground")}>{fmtSigned(b.trophies)}</span>
                  <Stars count={b.stars} className="text-[10px]" />
                  <span className="sr-only">
                    {b.attack ? "against" : "by"} {b.opponentName}, {b.destruction}% destruction. Show the army.
                  </span>
                </button>
              </li>
            );
          })}
          {Array.from({ length: empty }, (_, i) => (
            <li
              key={`empty-${i}`}
              aria-hidden
              className="flex min-h-12 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground"
            >
              –
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div id={panelId} className="grid gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr]">
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{selected.attack ? "Against" : "By"}</dt>
            <dd className="min-w-0">
              <Link href={playerHref(selected.opponentTag)} className="block truncate font-medium hover:underline">
                {selected.opponentName}
              </Link>
              {selected.opponentTownHall != null && <span className="text-muted-foreground">TH{selected.opponentTownHall}</span>}
            </dd>
            <dt className="text-muted-foreground">Result</dt>
            <dd className="flex items-center gap-2">
              <Stars count={selected.stars} /> {selected.destruction}%
            </dd>
            <dt className="text-muted-foreground">Trophies</dt>
            <dd className="tabular">
              {estimated ? "≈" : ""}
              {fmtSigned(selected.trophies)}
            </dd>
            <dt className="text-muted-foreground">Time</dt>
            <dd>{TIME_FMT.format(new Date(selected.whenIso))} UTC</dd>
          </dl>
          {selected.army || selected.armyLink ? (
            <ArmyView army={selected.army} armyLink={selected.armyLink} attack={selected.attack} opponentName={selected.opponentName} />
          ) : (
            <div className="space-y-1">
              <h4 className="text-xs text-muted-foreground">{selected.attack ? "Army used" : `Army used by ${selected.opponentName}`}</h4>
              <p className="text-muted-foreground">Not available: this battle is no longer in the game&apos;s battle log.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
