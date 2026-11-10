import { connection } from "next/server";
import { Suspense } from "react";

async function Connection() {
  await connection();
  return null;
}

/**
 * Tells Next.js the route's dynamic metadata (titles from clan/player names)
 * is intentional, without pulling the rest of the page out of the static shell.
 * See generateMetadata > With Cache Components in the Next.js docs.
 */
export function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  );
}
