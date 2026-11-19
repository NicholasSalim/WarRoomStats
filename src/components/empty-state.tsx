import type { ReactNode } from "react";

/** A dashed box for "nothing to show here" messages. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
