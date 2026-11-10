import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { getClan } from "@/lib/coc/client";
import { TAB_SEO } from "@/lib/site";

export function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** "Name (#TAG) · War log" for a clan tab page's browser title. */
export async function clanTabMetadata(params: Promise<{ tag: string }>, tab: string): Promise<Metadata> {
  const { tag } = await params;
  const result = await getClan(tag);
  return { title: result.ok ? `${result.data.name} (${result.data.tag}) · ${tab}` : tab, ...TAB_SEO };
}
