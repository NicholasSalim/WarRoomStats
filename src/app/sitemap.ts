import type { MetadataRoute } from "next";
import { getClanRankings, getPlayerRankings } from "@/lib/coc/client";
import { clanHref, playerHref } from "@/lib/coc/tag";
import { SITE_URL } from "@/lib/site";

// The home page, leaderboards and the global top 200 clans and players: the
// pages people search for most. Both rankings come from cached calls (about
// an hour), so the sitemap costs at most two API calls an hour. If the API
// is down, the sitemap still lists the fixed pages.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, SITE_URL).toString();
  const [clans, players] = await Promise.all([getClanRankings("global"), getPlayerRankings("global")]);
  return [
    { url: url("/"), changeFrequency: "hourly", priority: 1 },
    { url: url("/leaderboards"), changeFrequency: "hourly", priority: 0.9 },
    { url: url("/leaderboards?kind=clans"), changeFrequency: "hourly", priority: 0.8 },
    ...(clans.ok ? clans.data : []).map((c) => ({ url: url(clanHref(c.tag)), changeFrequency: "daily" as const, priority: 0.6 })),
    ...(players.ok ? players.data : []).map((p) => ({ url: url(playerHref(p.tag)), changeFrequency: "daily" as const, priority: 0.5 })),
  ];
}
