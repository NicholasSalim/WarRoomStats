import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Link-based pagination (works without JS). Pass `totalPages` when the total
// is known; otherwise `hasMore` says whether a next page exists, and a small
// GET form lets visitors jump straight to a page.

interface PagerProps {
  path: string;
  /** Other search params to keep on every page link. */
  params: Record<string, string>;
  page: number;
  totalPages?: number;
  hasMore?: boolean;
}

function href(
  path: string,
  params: Record<string, string>,
  page: number,
): string {
  const q = new URLSearchParams(params);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Page numbers around the current one, with gaps ("…") collapsed. */
function pageWindow(page: number, total: number): Array<number | "gap"> {
  const keep = new Set(
    [1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total),
  );
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/**
 * Page numbers when the total isn't known (the Legend archive doesn't say how
 * many pages it has): 1, the pages around the current one, and a trailing gap
 * while there are more.
 */
function openWindow(page: number, hasMore: boolean): Array<number | "gap"> {
  const out: Array<number | "gap"> = [1];
  const from = Math.max(2, page - 1);
  if (from > 2) out.push("gap");
  for (let p = from; p <= page + (hasMore ? 1 : 0); p++) out.push(p);
  if (hasMore) out.push("gap");
  return out;
}

const item =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm tabular transition-colors";

export function Pager({ path, params, page, totalPages, hasMore }: PagerProps) {
  const next = totalPages !== undefined ? page < totalPages : Boolean(hasMore);
  if (page === 1 && !next) return null;
  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-1">
        <PageLink
          enabled={page > 1}
          to={href(path, params, page - 1)}
          label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </PageLink>
        {(totalPages !== undefined
          ? pageWindow(page, totalPages)
          : openWindow(page, next)
        ).map((p, i) =>
          p === "gap" ? (
            <span key={`gap${i}`} className={cn(item, "text-muted-foreground")}>
              …
            </span>
          ) : (
            <Link
              key={p}
              href={href(path, params, p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                item,
                p === page
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p}
            </Link>
          ),
        )}
        <PageLink
          enabled={next}
          to={href(path, params, page + 1)}
          label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" aria-hidden />
        </PageLink>
      </div>
      {totalPages === undefined && (
        <form
          action={path}
          method="get"
          className="flex items-center gap-2 text-sm"
        >
          {Object.entries(params).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {/* Wrapped label: the pager can appear twice on a page, so no shared id. */}
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Go to page</span>
            <input
              name="page"
              type="number"
              min={1}
              max={99999}
              inputMode="numeric"
              defaultValue={page}
              className="h-8 w-20 rounded-md border border-border bg-background px-2 tabular"
            />
          </label>
          <button
            type="submit"
            aria-label="Go to page"
            title="Go to page"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Search className="size-4" aria-hidden />
          </button>
        </form>
      )}
    </nav>
  );
}

function PageLink({
  enabled,
  to,
  label,
  children,
}: {
  enabled: boolean;
  to: string;
  label: string;
  children: React.ReactNode;
}) {
  const cls = cn(item, "gap-1");
  if (!enabled) {
    return (
      <span aria-disabled className={cn(cls, "text-muted-foreground/50")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={to}
      aria-label={label}
      className={cn(
        cls,
        "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
