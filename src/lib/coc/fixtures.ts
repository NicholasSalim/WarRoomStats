// fetch-compatible fixture server used when COC_API_MOCK=1 (local runs and CI, never on Vercel).
// Fixtures come from scripts/generate-fixtures.mjs.
//
// Any valid tag returns the fixture data, except these reserved prefixes,
// which simulate error states:
//   #888...  404 not found
//   #999...  503 maintenance
//   #22...   private war log (war log and current war answer 403)
//   #28...   not in war, and no CWL group; for players: no ranked group (like Legend)

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cursorPosition } from "./rankings";

const FIXTURE_DIR = join(process.cwd(), "src", "lib", "coc", "fixtures");

async function load(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(FIXTURE_DIR, name), "utf8"));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Mock Legend archive: two finished seasons (plus one old monthly id) of 250 players each. */
const MOCK_LEGEND_SEASONS = ["v2-2026-09-28T05:00:00Z", "v2-2026-10-26T05:00:00Z"];
const MOCK_ARCHIVE_SIZE = 250;

async function legendArchivePage(url: URL): Promise<Response> {
  const template = ((await load("rankings-players.json")) as { items: Array<Record<string, unknown>> }).items;
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const start = cursorPosition(url.searchParams.get("after"));
  const items = [];
  for (let pos = start; pos < Math.min(start + limit, MOCK_ARCHIVE_SIZE); pos++) {
    const base = template[pos % template.length];
    // Unique tags per row (tags only use 0289PYLQGRJCUV); trophies fall with rank.
    const suffix = pos.toString(14).toUpperCase().replace(/[0-9A-D]/g, (c) => "0289PYLQGRJCUV"[parseInt(c, 14)]);
    // Archive rows have no previousRank.
    items.push({ ...base, previousRank: undefined, tag: `${String(base.tag)}${suffix}`, rank: pos + 1, trophies: 6000 - pos * 4 });
  }
  const end = start + items.length;
  const after = end < MOCK_ARCHIVE_SIZE ? Buffer.from(JSON.stringify({ pos: end })).toString("base64url") : undefined;
  return json({ items, paging: { cursors: after ? { after } : {} } });
}

const MOCK_CLAN_LABELS = [
  { id: 56000000, name: "Clan Wars" },
  { id: 56000001, name: "Clan War League" },
  { id: 56000002, name: "Trophy Pushing" },
  { id: 56000008, name: "Farming" },
  { id: 56000016, name: "Clan Capital" },
];

/** A small raid log (one clan raided, one defense) added to the latest mock raid weekend. */
function withRaidLogs(seasons: { items: Array<Record<string, unknown>> }) {
  const members = (seasons.items[0]?.members as Array<{ tag: string; name: string }> | undefined) ?? [];
  const district = (id: number, name: string, hall: number, attackers: typeof members) => ({
    id,
    name,
    districtHallLevel: hall,
    destructionPercent: 100,
    stars: 3,
    attackCount: attackers.length,
    totalLooted: 4000 + hall * 900,
    attacks: attackers.map((m, i) => ({ attacker: { tag: m.tag, name: m.name }, destructionPercent: i === attackers.length - 1 ? 100 : 60, stars: 3 })),
  });
  const log = {
    attackCount: 6,
    districtCount: 2,
    districtsDestroyed: 2,
    districts: [district(70000000, "Capital Peak", 10, members.slice(0, 4)), district(70000001, "Barbarian Camp", 5, members.slice(4, 6))],
  };
  const raided = { tag: "#2YQ8RP2LG", name: "Raid Target", level: 15 };
  const raider = { tag: "#2GJ8UY2CP", name: "Raid Visitor", level: 12 };
  return {
    ...seasons,
    items: seasons.items.map((season, i) =>
      i === 0 ? { ...season, attackLog: [{ defender: raided, ...log }], defenseLog: [{ attacker: raider, ...log, districts: [] }] } : season,
    ),
  };
}

const apiTime = (d: Date) => d.toISOString().replace(/[-:]/g, "");

/** Moves a fixture war's timestamps so it looks live relative to now. */
function shiftWarTimes<T extends Record<string, unknown>>(war: T, startOffsetHours: number): T {
  const start = new Date(Date.now() + startOffsetHours * 3_600_000);
  return {
    ...war,
    preparationStartTime: apiTime(new Date(start.getTime() - 23 * 3_600_000)),
    startTime: apiTime(start),
    warStartTime: apiTime(start),
    endTime: apiTime(new Date(start.getTime() + 24 * 3_600_000)),
  };
}

export async function fixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  // mock://coc/clans/%23TAG/... -> ["clans", "#TAG", ...]
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [resource, id, sub, sub2] = parts;

  if (id?.startsWith("#888")) return json({ reason: "notFound", message: "Not found" }, 404);
  if (id?.startsWith("#999")) return json({ reason: "inMaintenance", message: "Maintenance" }, 503);

  if (resource === "clans" && !id) return json(await load("clan-search.json"));

  if (resource === "clans" && id) {
    if (!sub) return json(await load("clan.json"));
    if (sub === "warlog") {
      if (id.startsWith("#22")) return json({ reason: "accessDenied" }, 403);
      return json(await load("warlog.json"));
    }
    if (sub === "currentwar" && sub2 === "leaguegroup") {
      if (id.startsWith("#28")) return json({ reason: "notFound" }, 404);
      return json(await load("leaguegroup.json"));
    }
    if (sub === "currentwar") {
      if (id.startsWith("#22")) return json({ reason: "accessDenied" }, 403);
      if (id.startsWith("#28")) return json({ state: "notInWar" });
      return json(shiftWarTimes((await load("currentwar.json")) as Record<string, unknown>, -6));
    }
    if (sub === "capitalraidseasons") {
      return json(withRaidLogs((await load("capitalraidseasons.json")) as { items: Array<Record<string, unknown>> }));
    }
  }

  if (resource === "clanwarleagues" && id === "wars" && sub) {
    const wars = (await load("cwl-wars.json")) as Record<string, Record<string, unknown>>;
    const war = wars[sub];
    if (!war) return json({ reason: "notFound" }, 404);
    return json(war.state === "inWar" ? shiftWarTimes(war, -5) : war);
  }

  if (resource === "players" && id) {
    if (sub === "battlelog") return json(await load("battlelog.json"));
    if (sub === "leaguehistory") {
      // "#28" players are Legend-style: no group and no finished ranked seasons.
      return json(id.startsWith("#28") ? { items: [] } : await load("leaguehistory.json"));
    }
    const player = (await load("player.json")) as Record<string, unknown>;
    if (id.startsWith("#28")) return json({ ...player, currentLeagueGroupTag: "#0" });
    return json(player);
  }

  // /leaguegroup/{groupTag}/{seasonId}?playerTag=...
  if (resource === "leaguegroup" && id && sub) return json(await load("ranked-group.json"));
  if (resource === "leaguetiers" && !id) return json(await load("leaguetiers.json"));

  // /leagues/29000022/seasons[/{seasonId}]
  if (resource === "leagues" && sub === "seasons") {
    if (!sub2) return json({ items: ["2015-07", ...MOCK_LEGEND_SEASONS].map((id) => ({ id })), paging: { cursors: {} } });
    return legendArchivePage(url);
  }

  if (resource === "locations" && !id) return json(await load("locations.json"));
  if (resource === "locations" && id && sub === "rankings") {
    if (sub2 === "players") return json(await load("rankings-players.json"));
    if (sub2 === "clans") return json(await load("rankings-clans.json"));
    // Builder Base and Capital boards reuse the main fixtures with their own points field.
    type Rows = { items: Array<Record<string, unknown>>; paging: unknown };
    if (sub2 === "players-builder-base") {
      const b = (await load("rankings-players.json")) as Rows;
      return json({
        ...b,
        items: b.items.map(({ trophies, ...r }) => ({ ...r, attackWins: undefined, defenseWins: undefined, builderBaseTrophies: Number(trophies) - 1500 })),
      });
    }
    if (sub2 === "clans-builder-base" || sub2 === "capitals") {
      const b = (await load("rankings-clans.json")) as Rows;
      const field = sub2 === "capitals" ? "clanCapitalPoints" : "clanBuilderBasePoints";
      return json({ ...b, items: b.items.map(({ clanPoints, ...r }) => ({ ...r, [field]: Math.round(Number(clanPoints) / 8) })) });
    }
  }

  if (resource === "labels" && id === "clans") return json({ items: MOCK_CLAN_LABELS, paging: { cursors: {} } });
  if (resource === "goldpass" && id === "seasons" && sub === "current") {
    const day = 86_400_000;
    return json({ startTime: apiTime(new Date(Date.now() - 8 * day)), endTime: apiTime(new Date(Date.now() + 22 * day)) });
  }

  return json({ reason: "notFound", message: `No fixture for ${url.pathname}` }, 404);
}
