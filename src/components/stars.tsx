import { cn } from "@/lib/utils";

/** Three-star readout, e.g. ★★☆, with an accessible label. */
export function Stars({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("inline-flex tracking-tight", className)} aria-label={`${count} star${count === 1 ? "" : "s"}`} role="img">
      {[0, 1, 2].map((i) => (
        <span key={i} aria-hidden className={i < count ? "text-foreground" : "text-muted-foreground/40"}>
          ★
        </span>
      ))}
    </span>
  );
}
