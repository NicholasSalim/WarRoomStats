import { Suspense } from "react";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { WarView } from "@/components/war-view";
import { getCurrentWar } from "@/lib/coc/client";
import { clanTabMetadata } from "../clan-data";

export function generateMetadata({ params }: PageProps<"/clan/[tag]/war">) {
  return clanTabMetadata(params, "Current war");
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
  if (!result.ok) {
    if (result.error.kind === "notFound" || result.error.kind === "invalidTag") return null; // Shown by the layout.
    return <ErrorState error={result.error} />;
  }
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
