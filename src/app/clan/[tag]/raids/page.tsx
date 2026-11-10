import Link from "next/link";
import { Suspense } from "react";
import { ErrorState } from "@/components/error-state";
import { Section } from "@/components/stat";
import { getCapitalRaids } from "@/lib/coc/client";
import { parseApiTime } from "@/lib/coc/stats";
import { normalizeTag } from "@/lib/coc/tag";
import { cn } from "@/lib/utils";
import { fmtDate, fmtInt } from "@/lib/format";
import { RaidDetails } from "../raid-details";
import { SectionSkeleton, clanTabMetadata } from "../clan-data";

export function generateMetadata({ params }: PageProps<"/clan/[tag]/raids">) {
  return clanTabMetadata(params, "Raid weekends");
}

type Params = PageProps<"/clan/[tag]/raids">["params"];
type SearchParams = PageProps<"/clan/[tag]/raids">["searchParams"];

export default function ClanRaidsPage({
  params,
  searchParams,
}: PageProps<"/clan/[tag]/raids">) {
  return (
    <Suspense fallback={<SectionSkeleton rows={4} />}>
      <RaidsSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// ---------- Capital raids ----------

async function RaidsSection({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ tag }, sp] = await Promise.all([params, searchParams]);
  const result = await getCapitalRaids(tag);
  if (!result.ok) {
    if (result.error.kind === "notFound" || result.error.kind === "invalidTag")
      return null;
    return (
      <Section id="raids" title="Raid weekends">
        <ErrorState error={result.error} compact />
      </Section>
    );
  }
  const seasons = result.data;
  if (seasons.length === 0) {
    return (
      <Section id="raids" title="Raid weekends">
        <p className="text-sm text-muted-foreground">No raid weekends yet.</p>
      </Section>
    );
  }
  // One weekend in detail at a time (all 20 at once is several MB of HTML).
  const picked =
    typeof sp.weekend === "string"
      ? seasons.find((s) => s.startTime.startsWith(sp.weekend as string))
      : undefined;
  const selected = picked ?? seasons[0];
  const slug = (normalizeTag(tag) ?? tag).replace(/^#/, "");
  return (
    <Section
      id="raids"
      title="Raid weekends"
      description="Select a weekend for its raiders, raids and defenses."
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Weekend
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Loot
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Attacks
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2 text-right font-medium sm:table-cell"
              >
                Raids
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2 text-right font-medium sm:table-cell"
              >
                Districts
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Medals
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {seasons.map((s) => (
              <tr
                key={s.startTime}
                aria-current={s === selected ? "true" : undefined}
                className={cn(s === selected && "bg-muted/60")}
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/clan/${slug}/raids?weekend=${s.startTime.slice(0, 8)}#weekend`}
                    className={cn(
                      "hover:underline",
                      s === selected && "font-medium",
                    )}
                  >
                    {fmtDate(parseApiTime(s.startTime))}
                  </Link>
                  {s.state === "ongoing" && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      Live
                    </span>
                  )}
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {fmtInt(s.capitalTotalLoot)}
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {fmtInt(s.totalAttacks)}
                </td>
                <td className="tabular hidden px-3 py-2 text-right sm:table-cell">
                  {fmtInt(s.raidsCompleted)}
                </td>
                <td className="tabular hidden px-3 py-2 text-right sm:table-cell">
                  {fmtInt(s.enemyDistrictsDestroyed)}
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {s.state === "ongoing"
                    ? "–"
                    : fmtInt(
                        (s.offensiveReward ?? 0) * 6 + (s.defensiveReward ?? 0),
                      )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div id="weekend" className="scroll-mt-20">
        <RaidDetails season={selected} />
      </div>
    </Section>
  );
}
