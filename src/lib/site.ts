import type { Metadata } from "next";

// The site's public address, for canonical URLs, link previews, robots.txt
// and the sitemap. Set SITE_URL once a custom domain exists; on Vercel it
// otherwise falls back to the project's production domain.

function siteUrl(): URL {
  if (process.env.SITE_URL) return new URL(process.env.SITE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return new URL("http://localhost:3000");
}

export const SITE_URL = siteUrl();

export const SITE_NAME = "WarRoomStats";

/**
 * For clan and player tabs: kept out of search results (robots.txt keeps
 * crawlers off them too, to spare the API), and without the overview's
 * canonical URL, which they'd otherwise inherit from the layout.
 */
export const TAB_SEO = { robots: { index: false, follow: true }, alternates: { canonical: null } } satisfies Metadata;
