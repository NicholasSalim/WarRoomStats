# WarRoomStats

A free, non-commercial stats viewer for clans, wars, Clan War League, raid weekends, players and leaderboards. It uses live data from the official game API.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in COC_API_TOKEN
npm run dev
```

No API token yet? Use the fixture data:

```bash
COC_API_MOCK=1 npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests (client, schemas, stats) |
| `npm run test:e2e` | Playwright smoke tests in fixture mode (first run: `npx playwright install chromium`) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run fixtures` | Regenerate the API fixtures |
| `node scripts/build-army-ids.mjs` | Refresh the unit id → name table used to decode battle log armies |
| `node scripts/build-unit-icons.mjs` | Link the unit images in `public/{troops,siege-machines,spells,heroes,hero-pets,hero-equipments}` to unit names (run after adding images) |

## Layout

- `src/lib/coc/`: the server-only CoC API client (`client.ts`), plus transport, zod schemas, tag handling, stats and fixtures.
- `src/app/`: pages. Home `/`, `/search`, `/clan/[tag]` (+ `/war`, `/cwl`), `/player/[tag]`, `/leaderboards`.
- `src/proxy.ts`: per-IP rate limiting.

---

This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy: www.supercell.com/fan-content-policy.
