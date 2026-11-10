"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrophyPoint {
  day: number;
  label: string;
  /** League trophies at the end of the day (or now, for today); null when unknown. */
  trophies: number | null;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrophyPoint }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="tabular text-sm font-semibold text-foreground">{p.trophies == null ? "Not available" : p.trophies.toLocaleString("en-US")}</p>
      <p className="text-muted-foreground">
        Day {p.day} · {p.label}
      </p>
    </div>
  );
}

/** League trophies at the end of each day of the season. */
export function TrophyChart({ data, estimated }: { data: TrophyPoint[]; estimated: boolean }) {
  const known = data.filter((d) => d.trophies != null);
  return (
    <figure className="rounded-lg border border-border bg-card p-4">
      <figcaption className="mb-3 text-sm font-medium">
        League trophies at the end of each day{estimated && <span className="font-normal text-muted-foreground"> (estimated)</span>}
      </figcaption>
      <div
        className="h-56"
        role="img"
        aria-label={`League trophies by day; ${known.length} of ${data.length} days known. The day list below has the same numbers.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="#262626" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: "#262626" }}
              tick={{ fill: "#a1a1a1", fontSize: 11 }}
              tickFormatter={(d: number) => `D${d}`}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={["auto", "auto"]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#a1a1a1", fontSize: 11 }}
              width={52}
              tickFormatter={(v: number) => v.toLocaleString("en-US")}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#525252" }} />
            <Line
              type="linear"
              dataKey="trophies"
              stroke="#ededed"
              strokeWidth={2}
              dot={{ r: 4, fill: "#ededed", stroke: "#0a0a0a", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "#ededed", stroke: "#0a0a0a", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
