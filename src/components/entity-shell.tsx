import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The frame shared by the clan and player layouts: the header (picture, name,
// a line of details, the tab nav) and the metadata for link previews. Each
// layout loads its own entity and fills the slots.

export function EntityHeader({
  avatar,
  name,
  details,
  aside,
  nav,
}: {
  avatar: ReactNode;
  name: string;
  details: ReactNode;
  /** Shown beside the name, wrapping below it on small screens (the player's league). */
  aside?: ReactNode;
  nav: ReactNode;
}) {
  return (
    <header className="space-y-5">
      <div className={cn("flex items-center gap-4", aside && "flex-wrap")}>
        {avatar}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">{details}</p>
        </div>
        {aside}
      </div>
      {nav}
    </header>
  );
}

export function EntityHeaderSkeleton({ navClassName }: { navClassName: string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className={navClassName} />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Title, description and link-preview card for a clan or player overview. */
export function entityMetadata({
  name,
  tag,
  href,
  stats,
  about,
  image,
}: {
  name: string;
  tag: string;
  href: string;
  /** Short facts joined with " · "; empty values are skipped. */
  stats: (string | null | undefined | false)[];
  /** What the pages cover, e.g. "Members, wars and raid weekends". */
  about: string;
  image?: { url: string | undefined; alt?: string };
}): Metadata {
  const title = `${name} (${tag})`;
  const description = `${stats.filter(Boolean).join(" · ")}. ${about} for ${name}.`;
  return {
    title,
    description,
    alternates: { canonical: href },
    openGraph: { title, description, url: href, images: image?.url ? [{ url: image.url, alt: image.alt }] : undefined },
  };
}
