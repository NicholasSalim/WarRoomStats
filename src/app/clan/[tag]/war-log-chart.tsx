"use client";

import { RESULT_STYLE, type WarOutcome } from "@/lib/coc/war-outcome";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface WarMarginPoint {
  key: string;
  label: string;
  opponent: string;
  result: WarOutcome;
  margin: number;
  ours: number;
  theirs: number;
}

/** Bar with a 4px rounded data end and a square end on the zero baseline. */
function MarginBar(props: { x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: WarMarginPoint }) {
  const { x = 0, y = 0, width = 0, fill } = props;
  let { height = 0 } = props;
  const negative = (props.payload?.margin ?? 0) < 0;
  let top = y;
  if (height < 0) {
    top = y + height;
    height = -height;
  }
  const w = Math.min(width, 24);
  const left = x + (width - w) / 2;
  if (height === 0) return <rect x={left} y={top - 1} width={w} height={2} fill={fill} />;
  const r = Math.min(4, height, w / 2);
  const d = negative
    ? `M${left},${top} h${w} v${height - r} q0,${r} -${r},${r} h-${w - 2 * r} q-${r},0 -${r},-${r} Z`
    : `M${left},${top + height} v-${height - r} q0,-${r} ${r},-${r} h${w - 2 * r} q${r},0 ${r},${r} v${height - r} Z`;
  return <path d={d} fill={fill} />;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: WarMarginPoint }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="text-sm font-semibold text-foreground tabular">
        {p.margin > 0 ? "+" : ""}
        {p.margin} stars
      </p>
      <p className="text-muted-foreground">
        <span className="mr-1.5 inline-block h-0.5 w-3 align-middle" style={{ background: RESULT_STYLE[p.result].color }} />
        {RESULT_STYLE[p.result].label} vs {p.opponent}
      </p>
      <p className="text-muted-foreground tabular">
        {p.ours} – {p.theirs} · {p.label}
      </p>
    </div>
  );
}

const OUTCOMES: WarOutcome[] = ["win", "lose", "tie"];

export function WarLogChart({ data }: { data: WarMarginPoint[] }) {
  const present = OUTCOMES.filter((k) => data.some((d) => d.result === k));
  return (
    <figure className="rounded-lg border border-border bg-card p-4">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Star margin, oldest to newest</span>
        <ul className="flex gap-3 text-xs text-muted-foreground" aria-label="Legend">
          {present.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: RESULT_STYLE[k].color }} />
              {RESULT_STYLE[k].label}
            </li>
          ))}
        </ul>
      </figcaption>
      <div className="h-48" role="img" aria-label="Star margin for each recent regular war; the war list below has the same numbers.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="key" hide />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              width={44}
            />
            <ReferenceLine y={0} stroke="var(--ring)" />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="margin" shape={<MarginBar />} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={RESULT_STYLE[d.result].color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
