import type { NextConfig } from "next";
import { hasRedisEnv } from "./src/lib/rate-limit";

const isDev = process.env.NODE_ENV === "development";

// Rate limiting (src/proxy.ts) protects the shared API token's quota and is
// skipped when Upstash isn't configured. Never let a production deploy go out
// without it. Local builds and Vercel previews are unaffected.
if (process.env.VERCEL_ENV === "production" && !hasRedisEnv(process.env)) {
  throw new Error(
    "Upstash Redis must be configured for production (UPSTASH_REDIS_REST_URL/TOKEN, or KV_REST_API_URL/TOKEN from the Vercel integration): it enables rate limiting.",
  );
}

// Clan badges, league icons etc. are loaded straight from Supercell's asset CDN.
const COC_ASSET_HOST = "https://api-assets.clashofclans.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${COC_ASSET_HOST}`,
  "font-src 'self'",
  "connect-src 'self' https://vitals.vercel-insights.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Unit images in public/ are up to 1 MB; next/image serves small resized copies.
  // Only these folders may be optimised.
  images: {
    // Only the widths the unit icons use (21, 28 and 44 px at 1x and 2x round
    // up to these). /_next/image isn't rate-limited, so every allowed width is
    // another resize a bot could force per image; Next's defaults allow 15.
    imageSizes: [32, 48, 64, 96],
    deviceSizes: [128],
    localPatterns: ["troops", "siege-machines", "spells", "heroes", "hero-pets", "hero-equipments"].map((folder) => ({
      pathname: `/${folder}/**`,
      search: "",
    })),
  },
  // Cache lifetimes per CoC API endpoint family (docs/DECISIONS.md > Architecture).
  // Values are in seconds. `stale` is the client router cache window.
  cacheLife: {
    // Current war and CWL: about 60 s.
    war: { stale: 30, revalidate: 60, expire: 300 },
    // Clan and player profiles, war log, capital raids, clan search: about 5 min.
    profile: { stale: 60, revalidate: 300, expire: 3600 },
    // Official leaderboards: about 1 h.
    leaderboard: { stale: 300, revalidate: 3600, expire: 86400 },
    // /locations: 1 day.
    reference: { stale: 3600, revalidate: 86400, expire: 604800 },
    // Failed API calls are only kept briefly so a recovery shows up quickly.
    apiError: { stale: 30, revalidate: 30, expire: 60 },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
