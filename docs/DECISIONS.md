# WarRoomStats: design decisions (v1)

Agreed in a planning session on 2026-11-07. Change this file when a decision changes.

## Product
- **WarRoomStats** is a public, free, non-commercial Clash of Clans stats viewer. Anyone with the URL can use it. There are no user accounts.
- Supercell's Fan Content Policy applies:
  - Every page footer shows: *"This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy: www.supercell.com/fan-content-policy."*
  - "Clash" and "Supercell" must not appear in the app name, domain or logo.
  - No monetization of any kind.
  - Supercell assets are never modified.

## Data
- Show the maximum the API offers (decided 2026-11-10): every list asks the API for everything it keeps, then pages it locally where it's long. Limits found: rankings 200 per board; clan search 832; war log whole history; raid weekends 20; battle log about 50 battles; league history about 5 weeks; Legend archive every finished season.
- The app makes live calls to the official Clash of Clans API only. **There is no database and no stored history.**
- Out of scope for v1, because the API doesn't keep this data: battle history older than the API's recent battle log (a few days), trends over time, past CWL seasons, and custom leaderboards.
- Updated 2026-11-07 after testing the live API: the league rework replaced `legendStatistics` with `leagueTier` and weekly ranked groups. The API does expose per-battle data, which v1 now uses: `/players/{tag}/battlelog` (last ~40-50 battles), `/leaguegroup/{groupTag}/{seasonId}?playerTag=` (this week's group and the player's attack/defense logs with trophies), `/players/{tag}/leaguehistory` (finished seasons) and `/leaguetiers`.
- API access goes through the RoyaleAPI proxy. Its IP is whitelisted on the API key, and the base URL lives in `COC_API_BASE_URL`, so we can swap in our own VPS proxy later.

## Pages
1. Home / search: a large hero with the search, a season countdown, then the global top 20 players and top 20 clans with links to the full leaderboards. The last 10 searches are kept in `localStorage`; each can be removed on its own, or all at once with "Clear all".
   - The home search has two tabs, "Find a clan" and "Find a player" (decided 2026-11-09; this replaced the tag lookup tab and the `/lookup` route). Player search is `/search/players` and takes a tag only (with or without "#"): the API has no player name search (`/players?name=` returns 404, checked live). Name search would need our own stored player index, a v2 topic.
   - Every clan search box takes a clan name or a clan tag (home page and the bar on /search). "#TAG" goes straight to the clan; a tag-shaped query without "#" shows the exact tag match first, then name matches.
   - Clan search shows every match the API returns (at most 832 per search, checked live), 50 per page. All matches are fetched in one request, trimmed to the listed fields and cached; pages are cut locally.
   - Clan search takes a name and/or up to 3 labels (from `/labels/clans`). Labels alone are enough. The API matches clans that carry every chosen label, and a clan has at most 3.
   - The season countdown (home page and clan members) is the Gold Pass season from `/goldpass/seasons/current`. Season challenges and donation counts reset when it ends.
2. Clan: a shared header and tabs like the player page (decided 2026-11-10), each its own route:
   - Overview `/clan/[tag]`: clan stats, Clan Capital district hall levels, labels and the members table (with rank movement from `previousClanRank`). Members stay on the overview.
   - Current war `/clan/[tag]/war` and CWL `/clan/[tag]/cwl` (pages 3 and 4 below).
   - War log `/clan/[tag]/warlog` (if public): every war the API keeps (it returns the whole log in one call, 60 to 140 wars back to 2016, checked 2026-11-10). Summary and chart cover all of it; the list shows 50 per page.
   - Raids `/clan/[tag]/raids`: all 20 raid weekends the API keeps, as a table; one selected weekend (`?weekend=YYYYMMDD`, default the latest) shows its raiders, the clans raided and the defenses per district. One at a time because all 20 in full is several MB of HTML.
   - Raid data limits (checked 2026-11-10): only the latest weekend has per-player data (the member list with attacks and loot, and who attacked each district). The other 19 have clan totals and per-district results only.
3. Current war: attacks, stars, destruction, map.
4. CWL: group standings, the 7 rounds, per-player stats for the current season.
5. Player: a shared header (Town Hall, name, tag, level, clan, league) and tabs, each its own route (decided 2026-11-09, so nothing needs a long scroll):
   - Overview `/player/[tag]`: profile stats.
   - Ranked `/player/[tag]/ranked`: ranked league summary (tier, allowance, group rank, Legend stats, past season finishes, link to the season page). The season page counts as this tab.
   - Battle log `/player/[tag]/battles`.
   - Wars `/player/[tag]/wars`: the player's attacks and defenses in their clan's current war and each round of the current CWL season. The API has no per-player war history and the war log only keeps clan totals, so older wars aren't available.
   - Raids `/player/[tag]/raids`: their attacks, loot and each district they hit in the latest raid weekend of their current clan (the only weekend with per-player data); links to the clan's Raids tab for all 20 weekends. Raids with a previous clan aren't included.
   - No Builder Base battles section: the battle log only has home village, ranked and legend battles (checked live across 14 players, 2026-11-09).
   - Progress `/player/[tag]/progress`: upgrade progress for heroes, equipment, troops, siege machines, pets, spells and Builder Base.
   - Achievements `/player/[tag]/achievements`.
   - Legend stats come from the profile's `legendStatistics` when the API includes it (only some Legend players have it): the live season rank, which also covers players past the top 200, plus the best season and lifetime Legend trophies.
   - Ranked battles are grouped by allowance on the season page (decided 2026-11-08; the player page no longer lists league days). Legend I gets one block per league day (05:00 to 05:00 UTC, 8 attacks + 8 defenses), built from the battle log's `legend` battles, because Legend I has no group logs. Every other tier gets one block for the weekly tournament, built from the group logs, with the tier's weekly attack count. Battles outside a period are never mixed in. The API doesn't publish allowances, so they live in `rankedAllowance()` in `src/lib/coc/stats.ts`, taken from community guides and checked against live data.
   - Season page `/player/[tag]/season` (decided 2026-11-08), linked from the ranked section's current-season row. It shows the current season day by day from day 1 to today, with a trophy chart. Each battle tile opens the army used (weekly tiers: matched from the battle log, so only recent battles have one).
     - Legend I: the season is 28 days. Trophies are estimated with `legendTrophies()` and rebuilt backwards from the current count. Player and battle log are fetched as one cached snapshot (`getLegendSnapshot`). Days older than the oldest Legend battle in the log say they're no longer available (live-only, no storage).
     - Weekly tiers: 7 days with exact trophies from the group logs.
   - Trophy facts (checked live, 2026-11-08):
     - Weekly tiers: league trophies start at 0 each week and equal attack trophies plus defense trophies. A defense entry's `trophies` is what the defender earned, not a loss.
     - Legend I: per-battle trophies are not in the API. The formula reproduced clashspot's tracked day totals exactly.
     - League history `leagueSeasonId` is the season end.
6. Leaderboards: official top players and clans, 100 per page. Players: Current Season, Past Seasons, Builder Base. Clans: Trophies, Builder Base, Clan Capital. Every live board is a top 200 by location. Global by default, with a country dropdown filled from `/locations` (cached for 1 day).
   - API limits (checked live, 2026-11-09): the live rankings stop at 200 rows, for players and clans alike, and the global top 200 players are all Legend I.
   - Players have two views (decided 2026-11-09): "Current Season" (the live top 200, the default) and "Past Seasons": every player of a finished Legend I season (about 12,000), from the Legend season archive `/leagues/29000022/seasons/{id}`. Pages are fetched with a cursor built from the page number (`archiveCursor` in `src/lib/coc/rankings.ts`). An archive id like `v2-2026-10-26T05:00:00Z` is 7 days before that season's end.
   - The API has no rankings for the other tiers (Legend II and below): `/leaguetiers/{id}/...` returns 404, and the archive only exists for Legend. Country rankings only list Legend players. The running season has no full list: the archive only fills in once a season ends.

## Architecture
- Next.js App Router. Pages are Server Components that call a **server-only** typed CoC client. The browser never talks to the CoC API.
- The client is a hand-written wrapper around `fetch`, with responses validated by `zod`. No third-party CoC library.
- Module layout (decided 2026-11-10, after an architecture review):
  - `src/lib/coc/endpoints.ts` declares every endpoint: path, input validation, schema, error remapping (`notInWar`, 404 → `cwlNotActive`) and cache lifetime. It has no Next.js imports and is unit-tested through the fixture fetch.
  - `client.ts` adds one shared `'use cache: remote'` boundary on top. Tags and search parameters are normalised *before* it, so "2pp", "#2PP" and the URL slug share one cache entry and one upstream call.
  - Combined loads live in pure modules that take their fetchers as arguments (`cwl-season.ts`, `ranked-season.ts`), bound to the client in `loaders.ts`. A CWL round war that fails to load is left out and counted (`missingWars`), and both the clan's CWL tab and the player's Wars tab say the data is incomplete. `rankedMode` alone decides between Legend I (daily, no group), a weekly tournament and unranked.
  - Clan and player tabs share `src/components/entity-tab.tsx`. The layout shows invalid-tag and not-found errors for the whole page; for data looked up by the page's own tag, a tab shows only the other errors (`TabError`). Data about another entity (the player's clan, a ranked group) shows every error, since "not found" there is news.
  - War results are decided, labelled and coloured in one place (`war-outcome.ts`): Win, Loss, Tie, plus CWL rows and "–" for a result the API didn't give, which is left out of the chart.
- Caching uses `'use cache: remote'` + `cacheLife` per endpoint (this Next.js has Cache Components on, which replaces `fetch` revalidate): about 60 s for war and CWL, about 5 min for profiles, about 1 h for leaderboards, and 1 day for locations. Finished Legend seasons never change, so their archive pages are kept as long as locations. Profiles are named in `next.config.ts`. Failed calls are only cached for about 1 min, except "not found", which is kept like a profile (about 5 min) so bots requesting made-up tags don't cost a call every time.
  - `remote` (decided 2026-11-10): plain `'use cache'` is in-memory per instance, and on serverless hosts its entries "typically don't persist across requests" (Next docs), so most visits would still call the API. The remote cache is shared across instances (Vercel provides it; locally it falls back to memory). Every visitor shares one API token, so this protects its quota.
  - Clan search fetches every match once (up to 832 clans, about 1.4 MB, measured at roughly the same time as fetching 50) and pages it from the cache, so pages 2 onwards cost nothing and the total is known. Searches are cached under a normalised key (`normalizeClanSearch`): the API ignores case and repeated spaces in names (checked live), so "War Machine" and "war  machine" share one entry.
- Security:
  - The API key is server-side only.
  - Tags are checked against `^#?[0289PYLQGRJCUV]+$` and normalised to uppercase with a `#` before any API call. The letter O is read as 0 (a common typo), and tags must be 2 to 16 characters.
  - Upstash `@upstash/ratelimit`, enforced in `src/proxy.ts` (Next 16 renamed middleware to proxy), per IP per minute: 60 page views (document loads and in-app navigations), plus 30 searches (`/search*`). Raised from 30 and 15 on 2026-11-11: a fast reader makes 10 to 20 page views a minute, and most are served from the cache. `src/lib/rate-limit.ts` holds the policy (budgets, precedence, Retry-After) behind a limiter port; `proxy.ts` only binds it to Upstash.
  - Static link prefetches (`rsc: 1` with `next-router-prefetch` 1 or 3) are not rate-limited: the proxy's `matcher` skips them (decided 2026-11-11). They return the route's prerendered shell from the CDN and never call the API, and a clan page's 50 member links make dozens of them. Until then they were charged as page views and a visitor hit the limit within a few clicks: Next.js strips these headers from the request the proxy function sees, so the check can only live in the matcher (`missing` conditions, tested in `src/proxy.test.ts`). Anything else on those paths is still a page view: a runtime prefetch (`2`) renders URL data, and a prefetch header without `rsc: 1` renders the full page.
  - Rate limiting is skipped when the Upstash variables are unset (local development), but a Vercel production build fails without them (`next.config.ts`).
  - Security headers are set in `next.config`.
- Error states each get a specific message: private war log, not in war, CWL not active, 404 not found, 503 maintenance, 429 rate-limited. A generic error boundary catches anything else.
  - A clan or player URL whose tag can't exist (`/clan/notatag`) gets a real 404 status (decided 2026-11-11): the proxy checks the format, with no API call, and rewrites to `/invalid-tag`. The pages themselves stream, so their status is fixed at 200 before they know; an unknown but well-formed tag shows "not found" with status 200 and `noindex`, because ruling it out needs an API call, which the proxy shouldn't make (Next docs, loading.md > Status codes).

## UI
- Tailwind with shadcn/ui and the Geist font. Mobile-first.
- Theme: pitch black `#000` background, white text, dark grey hovers and surfaces (around `#1a1a1a`), subtle borders (around `#262626`), muted grey secondary text. Same palette as the Vercel dashboard, but our own layout. Colours are theme tokens in `globals.css`, including the status colours `win`, `loss` and `tie` (war outcomes, rank changes), which are never used as chart series colours.
- Icons: clan badges and league icons come from the API. Troops, heroes and spells on the profile are shown as text with level bars.
- Battle log armies (decided 2026-11-07) use official Fan Kit icons for troops, spells, heroes, pets and equipment. The owner puts the images in `public/{troops,siege-machines,spells,heroes,hero-pets,hero-equipments}` (each under 1 MB); `scripts/build-unit-icons.mjs` links them to unit names, and `next/image` serves resized copies. Anything without an image falls back to its name. Third-party icon hosts are not used.
- Battle history stays live-only for v1 (decided 2026-11-07): longer history, like tracker sites keep, needs a database plus an always-on poller and is a v2 topic.
- Charts use Recharts. English only.

## Infra and testing
- Vercel Hobby, the Upstash free tier, Vercel Web Analytics, and GitHub with preview deploys. No Supabase.
- Environment variables: `COC_API_TOKEN`, `COC_API_BASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (required in Vercel production; the Vercel Upstash integration's `KV_REST_API_URL`/`KV_REST_API_TOKEN` also work), and optionally `SITE_URL` (defaults to the Vercel production domain).
- SEO (decided 2026-11-10): `robots.txt`, `sitemap.xml` (home, leaderboards, the global top 200 clans and players), `metadataBase`, and link-preview cards (clan badge, player league icon, stats in the description) on clan and player overviews. Every crawled clan or player page costs a live API call, so crawlers are kept off tabs, searches, deep leaderboard pages and the non-default boards (`?scope=`, added 2026-11-11) (robots.txt), and tabs and searches are `noindex`.
- Tests:
  - Vitest unit tests for the endpoints, the client's cache keys, loaders, rate-limit policy, schemas and stat calculations, run against JSON fixtures.
  - A Playwright smoke test per page.
  - GitHub Actions (`.github/workflows/ci.yml`, added 2026-11-11) runs typecheck, lint, unit tests, a production build and the smoke tests on every push and pull request. It needs no secrets: the build runs without an API token, and the smoke tests use the fixtures.
  - The Playwright MCP for manual checks of the dev or live site.
  - Without an API token, `COC_API_MOCK=1` serves the fixtures in `src/lib/coc/fixtures/` (generated by `scripts/generate-fixtures.mjs`). It is ignored in production builds. Reserved tag prefixes simulate errors: `#888` not found, `#999` maintenance, `#22` private war log, `#28` not in war / no CWL.
