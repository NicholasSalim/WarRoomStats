import type { Metadata } from "next";
import { ErrorState } from "@/components/error-state";
import { Section } from "@/components/stat";
import { Skeleton } from "@/components/ui/skeleton";
import { getClan, getPlayer } from "@/lib/coc/client";
import type { ApiError } from "@/lib/coc/errors";
import type { Clan, Player } from "@/lib/coc/schemas";
import { tabError } from "@/lib/coc/tab-errors";
import { TAB_SEO } from "@/lib/site";

// Shared by the tab pages under /clan/[tag] and /player/[tag]. The layout
// loads the clan or player for its header and shows the error when that
// fails; tabs get the same cached entity here, and use TabError so an error
// is shown exactly once (see tabError).

type TagParams = Promise<{ tag: string }>;

/** The clan for a tab page, or null when the layout is already showing why it couldn't load. */
export async function loadClan(params: TagParams): Promise<Clan | null> {
  const result = await getClan((await params).tag);
  return result.ok ? result.data : null;
}

/** The player for a tab page, or null when the layout is already showing why it couldn't load. */
export async function loadPlayer(params: TagParams): Promise<Player | null> {
  const result = await getPlayer((await params).tag);
  return result.ok ? result.data : null;
}

/**
 * Browser title "Name (#TAG) · Tab" for a clan or player tab page. Tab pages
 * aren't indexed (TAB_SEO); the entity's main page carries the description.
 */
export async function tabMetadata(
  kind: "clan" | "player",
  params: TagParams,
  tab: string,
  description?: (name: string) => string,
): Promise<Metadata> {
  const entity = kind === "clan" ? await loadClan(params) : await loadPlayer(params);
  if (!entity) return { title: tab, ...TAB_SEO };
  return {
    title: `${entity.name} (${entity.tag}) · ${tab}`,
    ...(description ? { description: description(entity.name) } : {}),
    ...TAB_SEO,
  };
}

/**
 * A tab's error for its own data. Renders nothing for errors the layout
 * already shows. With `section`, the message gets that section's heading;
 * `compact` is for a message inside an existing section.
 */
export function TabError({
  error,
  section,
  compact = false,
}: {
  error: ApiError;
  section?: { id?: string; title: string };
  compact?: boolean;
}) {
  const shown = tabError(error);
  if (!shown) return null;
  if (!section) return <ErrorState error={shown} compact={compact} />;
  return (
    <Section id={section.id} title={section.title}>
      <ErrorState error={shown} compact />
    </Section>
  );
}

/** Loading state for a tab: a heading and `rows` blocks. */
export function TabSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
