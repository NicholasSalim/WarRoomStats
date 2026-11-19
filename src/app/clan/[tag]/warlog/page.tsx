import Link from "next/link";
import { Suspense } from "react";
import { BadgeImage } from "@/components/badge-image";
import { Pager } from "@/components/pager";
import { Section, Stat, StatGrid } from "@/components/stat";
import { getWarLog } from "@/lib/coc/client";
import type { WarLogEntry } from "@/lib/coc/schemas";
import { paginate, parsePage } from "@/lib/paging";
import { parseApiTime, summarizeWarLog } from "@/lib/coc/stats";
import { RESULT_STYLE, isCwlLogEntry, isOutcome, warLogResult } from "@/lib/coc/war-outcome";
import { clanHref } from "@/lib/coc/tag";
import { fmtDate, fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WarLogChart, type WarMarginPoint } from "../war-log-chart";
import { TabError, TabSkeleton, tabMetadata } from "@/components/entity-tab";

export function generateMetadata({ params }: PageProps<"/clan/[tag]/warlog">) {
  return tabMetadata("clan", params, "War log");
}

type Params = PageProps<"/clan/[tag]/warlog">["params"];
type SearchParams = PageProps<"/clan/[tag]/warlog">["searchParams"];

/** Wars per page in the list; the summary and chart cover the whole log. */
const WARS_PER_PAGE = 50;

export default function ClanWarLogPage({
  params,
  searchParams,
}: PageProps<"/clan/[tag]/warlog">) {
  return (
    <Suspense fallback={<TabSkeleton rows={6} />}>
      <WarLogSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function WarLogSection({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ tag }, sp] = await Promise.all([params, searchParams]);
  const result = await getWarLog(tag);
  if (!result.ok) return <TabError error={result.error} section={{ id: "war-log", title: "War log" }} />;
  const items = result.data.items;
  const summary = summarizeWarLog(items);
  const { page, totalPages, shown, from } = paginate(items, parsePage(sp.page), WARS_PER_PAGE);
  const pager = (
    <Pager
      path={`${clanHref(tag)}/warlog`}
      params={{}}
      page={page}
      totalPages={totalPages}
    />
  );
  const oldest = parseApiTime(items.at(-1)?.endTime);
  const chartData: WarMarginPoint[] = items
    .flatMap((w) => {
      const result = warLogResult(w);
      return isOutcome(result) ? [{ war: w, result }] : [];
    })
    .map(({ war: w, result }) => ({
      key: w.endTime,
      label: fmtDate(parseApiTime(w.endTime)),
      opponent: w.opponent.name ?? "Unknown",
      result,
      margin: (w.clan.stars ?? 0) - (w.opponent.stars ?? 0),
      ours: w.clan.stars ?? 0,
      theirs: w.opponent.stars ?? 0,
    }))
    .reverse();

  return (
    <Section
      id="war-log"
      title="War log"
      description={
        items.length > 0
          ? `${fmtInt(items.length)} wars, regular and league${oldest ? `, back to ${fmtDate(oldest)}` : ""}.`
          : undefined
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No wars yet.</p>
      ) : (
        <>
          <StatGrid>
            <Stat
              label="Win rate"
              value={fmtPct(summary.winRate * 100, 0)}
              hint={`${summary.wins}W ${summary.losses}L ${summary.ties}T`}
            />
            <Stat
              label="Avg. stars"
              value={summary.avgStarsPerWar.toFixed(1)}
              hint="per regular war"
            />
            <Stat
              label="Avg. destruction"
              value={fmtPct(summary.avgDestruction)}
            />
            <Stat
              label="Regular wars"
              value={fmtInt(summary.wars)}
              hint={`of ${fmtInt(items.length)} in the log`}
            />
          </StatGrid>
          {chartData.length >= 3 && <WarLogChart data={chartData} />}
          {totalPages > 1 && (
            <p className="text-sm text-muted-foreground">
              Showing wars {fmtInt(from)}–{fmtInt(from + shown.length - 1)} of{" "}
              {fmtInt(items.length)}, newest first.
            </p>
          )}
          {pager}
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {shown.map((w) => (
              <WarLogRow key={w.endTime} war={w} />
            ))}
          </ul>
          {pager}
        </>
      )}
    </Section>
  );
}

function WarLogRow({ war }: { war: WarLogEntry }) {
  const cwl = isCwlLogEntry(war);
  const style = RESULT_STYLE[warLogResult(war)];
  return (
    <li className="flex items-center gap-3 px-4 py-3 text-sm">
      <span
        className={cn(
          "w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium",
          style.badge,
        )}
      >
        {style.label}
      </span>
      <div className="min-w-0 flex-1">
        {cwl ? (
          <span className="block text-muted-foreground">
            Clan War League season
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <BadgeImage src={war.opponent.badgeUrls?.small} alt="" size={20} />
            {war.opponent.tag ? (
              <Link
                href={clanHref(war.opponent.tag)}
                className="truncate hover:underline"
              >
                {war.opponent.name}
              </Link>
            ) : (
              <span className="truncate">{war.opponent.name}</span>
            )}
          </span>
        )}
        <span className="block text-xs text-muted-foreground">
          {fmtDate(parseApiTime(war.endTime))} · {war.teamSize} v {war.teamSize}
        </span>
      </div>
      <div className="tabular shrink-0 text-right">
        {cwl ? (
          <span>{fmtInt(war.clan.stars)} ★</span>
        ) : (
          <span>
            {war.clan.stars} <span className="text-muted-foreground">–</span>{" "}
            {war.opponent.stars} ★
          </span>
        )}
        <div className="text-xs text-muted-foreground">
          {fmtPct(war.clan.destructionPercentage)}
          {!cwl && ` – ${fmtPct(war.opponent.destructionPercentage)}`}
        </div>
      </div>
    </li>
  );
}
