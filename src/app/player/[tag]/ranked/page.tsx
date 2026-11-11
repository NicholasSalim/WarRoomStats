import { Suspense } from "react";
import { TabSkeleton, loadPlayer, tabMetadata } from "@/components/entity-tab";
import { normalizeTag, playerHref } from "@/lib/coc/tag";
import { RankedSection } from "../ranked-section";

export function generateMetadata({ params }: PageProps<"/player/[tag]/ranked">) {
  return tabMetadata("player", params, "Ranked");
}

export default function PlayerRankedPage({ params }: PageProps<"/player/[tag]/ranked">) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Ranked params={params} />
    </Suspense>
  );
}

async function Ranked({ params }: Pick<PageProps<"/player/[tag]/ranked">, "params">) {
  const [p, { tag }] = await Promise.all([loadPlayer(params), params]);
  if (!p) return null;
  // Links keep the tag the visitor asked for, like the tabs (see the layout).
  return <RankedSection player={p} seasonHref={`${playerHref(normalizeTag(tag) ?? p.tag)}/season`} />;
}
