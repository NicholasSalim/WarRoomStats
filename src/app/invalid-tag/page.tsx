import { ErrorState } from "@/components/error-state";
import { apiError } from "@/lib/coc/errors";

export const metadata = { title: "Invalid tag", robots: { index: false } };

// The proxy rewrites /clan/TAG and /player/TAG here, with status 404, when TAG
// can't be a tag at all (see isImpossibleTagPath). Unknown but well-formed
// tags need an API call to rule out, so their pages show "not found" instead.
export default function InvalidTagPage() {
  return <ErrorState error={apiError("invalidTag", 404)} />;
}
