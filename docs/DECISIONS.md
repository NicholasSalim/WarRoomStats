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
- The app makes live calls to the official Clash of Clans API only. **There is no database and no stored history.**
- Out of scope for v1, because the API doesn't keep this data: Legend League per-attack logs, trends over time, past CWL seasons, and custom leaderboards.
- API access goes through the RoyaleAPI proxy. Its IP is whitelisted on the API key, and the base URL lives in `COC_API_BASE_URL`, so we can swap in our own VPS proxy later.

## Pages
1. Home / search: search clans by name (with filters) or look up a player by tag. The last 8 searches are kept in `localStorage`.
2. Clan: overview, members (each links to the player page), war log (if public), Capital raid weekends.
3. Current war: attacks, stars, destruction, map.
4. CWL: group standings, the 7 rounds, per-player stats for the current season.
5. Player: profile, heroes, troops, spells, achievements, Legend trophies and last season's finish.
6. Leaderboards: official top players and clans. Global by default, with a country dropdown filled from `/locations` (cached for 1 day).

## Architecture
- Next.js App Router. Pages are Server Components that call a **server-only** typed CoC client. The browser never talks to the CoC API.
- The client is a hand-written wrapper around `fetch`, with responses validated by `zod`. No third-party CoC library.
- Caching uses `fetch` revalidate per endpoint: about 60 s for war and CWL, about 5 min for profiles, about 1 h for leaderboards, and 1 day for locations.
- Security:
  - The API key is server-side only.
  - Tags are checked against `^#?[0289PYLQGRJCUV]+$` and normalised to uppercase with a `#` before any API call.
  - Upstash `@upstash/ratelimit` allows about 30 requests per minute per IP, enforced in middleware/proxy.
  - Security headers are set in `next.config`.
- Error states each get a specific message: private war log, not in war, CWL not active, 404 not found, 503 maintenance, 429 rate-limited. A generic error boundary catches anything else.

## UI
- Tailwind with shadcn/ui and the Geist font. Mobile-first.
- Theme: pitch black `#000` background, white text, dark grey hovers and surfaces (around `#1a1a1a`), subtle borders (around `#262626`), muted grey secondary text. Same palette as the Vercel dashboard, but our own layout.
- Icons: clan badges and league icons come from the API. Troops, heroes and spells are shown as text with level bars; official fan-kit icons may be added later.
- Charts use Recharts. English only.

## Infra and testing
- Vercel Hobby, the Upstash free tier, Vercel Web Analytics, and GitHub with preview deploys. No Supabase.
- Environment variables: `COC_API_TOKEN`, `COC_API_BASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Tests:
  - Vitest unit tests for the client, schemas and stat calculations, run against JSON fixtures.
  - A Playwright smoke test per page.
  - The Playwright MCP for manual checks of the dev or live site.
