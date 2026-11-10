import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlayer } from "@/lib/coc/client";
import { TAB_SEO } from "@/lib/site";
import type { Player } from "@/lib/coc/schemas";

/**
 * The player for a tab page. Same cached call as the layout's header; when it
 * fails the layout already shows the error, so pages render nothing.
 */
export async function loadPlayer(params: Promise<{ tag: string }>): Promise<Player | null> {
  const { tag } = await params;
  const result = await getPlayer(tag);
  return result.ok ? result.data : null;
}

export function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/** "Name (#TAG) · Ranked" for a tab page's browser title. */
export async function tabMetadata(params: Promise<{ tag: string }>, tab: string): Promise<Metadata> {
  const p = await loadPlayer(params);
  return { title: p ? `${p.name} (${p.tag}) · ${tab}` : tab, ...TAB_SEO };
}
