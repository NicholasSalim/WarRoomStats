import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Every clan or player page a crawler opens costs a live call on the shared
// API token, so crawlers get the overview pages only. Tabs, searches and deep
// leaderboard pages are left out; they're reachable from the overviews.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/search",
        "/rate-limited",
        // Tabs: /clan/TAG/warlog, /player/TAG/battles, ...
        "/clan/*/",
        "/player/*/",
        // Leaderboard pages past the first, past seasons (12,000 players
        // each), and the other boards (Past Seasons, Builder Base, Capital).
        // The default board and ?kind=clans stay crawlable.
        "/leaderboards?*page=",
        "/leaderboards?*season=",
        "/leaderboards?*scope=",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
