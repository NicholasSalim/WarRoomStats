import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PlayerSearchBar } from "@/components/clan-search-bar";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlayer } from "@/lib/coc/client";
import { normalizeTag, playerHref } from "@/lib/coc/tag";

export const metadata = { title: "Player search", robots: { index: false } };

// Players are found by tag only: the official API has no player name search
// (checked live, 2026-11-09). A valid tag, with or without "#", opens the
// player; this page only renders when the tag is invalid or unknown.

type SearchParams = PageProps<"/search/players">["searchParams"];

export default function PlayerSearchPage({ searchParams }: PageProps<"/search/players">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Player search</h1>
        <div className="w-full sm:max-w-md">
          <Suspense fallback={<PlayerSearchBar />}>
            <BarWithQuery searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <Result searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function readQuery(searchParams: SearchParams): Promise<string> {
  const sp = await searchParams;
  return typeof sp.name === "string" ? sp.name.trim().slice(0, 50) : "";
}

async function BarWithQuery({ searchParams }: { searchParams: SearchParams }) {
  return <PlayerSearchBar defaultValue={await readQuery(searchParams)} />;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">{children}</p>
  );
}

async function Result({ searchParams }: { searchParams: SearchParams }) {
  const query = await readQuery(searchParams);
  if (!query) return <Note>Enter a player tag above. It&apos;s under the player&apos;s name on their in-game profile.</Note>;
  const tag = normalizeTag(query);
  if (!tag) return <Note>Tags only use 0 2 8 9 P Y L Q G R J C U V, for example #2PP.</Note>;
  const player = await getPlayer(tag);
  if (player.ok) redirect(playerHref(tag));
  if (player.error.kind !== "notFound") return <ErrorState error={player.error} />;
  return <Note>No player has the tag {tag}. Check it in-game under the player&apos;s name.</Note>;
}
