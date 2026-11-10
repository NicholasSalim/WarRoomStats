import { cn } from "@/lib/utils";

/** Unit level against its max, as text plus a thin bar (docs/DECISIONS.md > UI > Icons). */
export function LevelBar({ name, level, maxLevel }: { name: string; level: number; maxLevel: number }) {
  const ratio = maxLevel ? Math.min(1, level / maxLevel) : 0;
  const maxed = level >= maxLevel;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{name}</span>
        <span className={cn("tabular shrink-0 text-xs", maxed ? "text-foreground" : "text-muted-foreground")}>
          {level}
          <span className="text-muted-foreground">/{maxLevel}</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={`${name} level`}
        aria-valuemin={0}
        aria-valuemax={maxLevel}
        aria-valuenow={level}
      >
        <div
          className={cn("h-full rounded-full", maxed ? "bg-foreground" : "bg-muted-foreground")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
