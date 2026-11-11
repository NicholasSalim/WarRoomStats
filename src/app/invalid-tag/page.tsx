import { notFound } from "next/navigation";

export const metadata = { title: "Invalid tag", robots: { index: false } };

// The proxy rewrites /clan/TAG and /player/TAG here when TAG can't be a tag
// at all (see isImpossibleTagPath). Calling notFound() while prerendering
// stores this page with a 404 status, so it's served as a 404 whatever the
// host (a rewrite's own status isn't honoured by every host); the message is
// in not-found.tsx. Unknown but well-formed tags need an API call to rule
// out, so their pages show "not found" instead.
export default function InvalidTagPage() {
  notFound();
}
