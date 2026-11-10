import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { WarView } from "@/components/war-view";
import { getCurrentWar } from "@/lib/coc/client";
import { TabError, tabMetadata } from "@/components/entity-tab";

export function generateMetadata({ params }: PageProps<"/clan/[tag]/war">) {
  return tabMetadata("clan", params, "Current war");
}

export default function CurrentWarPage({ params }: PageProps<"/clan/[tag]/war">) {
  return (
    <Suspense fallback={<WarSkeleton />}>
      <CurrentWar params={params} />
    </Suspense>
  );
}

async function CurrentWar({ params }: Pick<PageProps<"/clan/[tag]/war">, "params">) {
  const { tag } = await params;
  const result = await getCurrentWar(tag);
  if (!result.ok) return <TabError error={result.error} />;
  return <WarView war={result.data} />;
}

function WarSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
