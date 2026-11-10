import { Suspense } from "react";
import { TabSkeleton, loadPlayer, tabMetadata } from "@/components/entity-tab";
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
  const p = await loadPlayer(params);
  if (!p) return null;
  return <RankedSection player={p} />;
}
