import { ErrorState } from "@/components/error-state";
import { apiError } from "@/lib/coc/errors";

export const metadata = { title: "Too many requests", robots: { index: false } };

// The proxy rewrites here (with status 429) when a visitor exceeds the rate limit.
export default function RateLimitedPage() {
  return <ErrorState error={apiError("rateLimited", 429)} />;
}
