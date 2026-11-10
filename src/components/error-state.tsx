import Link from "next/link";
import { AlertTriangle, Lock, Search, Swords, Timer, Wrench } from "lucide-react";
import { ERROR_COPY, type ApiError, type ApiErrorKind } from "@/lib/coc/errors";
import { cn } from "@/lib/utils";

const ICONS: Record<ApiErrorKind, typeof AlertTriangle> = {
  invalidTag: Search,
  notFound: Search,
  privateWarLog: Lock,
  notInWar: Swords,
  cwlNotActive: Swords,
  maintenance: Wrench,
  rateLimited: Timer,
  unavailable: AlertTriangle,
};

/** The specific message for an API error kind (docs/DECISIONS.md > Error states). */
export function ErrorState({
  error,
  compact = false,
  className,
}: {
  error: ApiError;
  compact?: boolean;
  className?: string;
}) {
  const copy = ERROR_COPY[error.kind];
  const Icon = ICONS[error.kind];
  return (
    <div
      role={error.kind === "unavailable" || error.kind === "maintenance" ? "alert" : "status"}
      data-error-kind={error.kind}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <Icon className="size-5 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{copy.title}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{copy.body}</p>
      </div>
      {!compact && (error.kind === "notFound" || error.kind === "invalidTag") && (
        <Link href="/" className="text-sm underline underline-offset-4 hover:text-foreground">
          Back to search
        </Link>
      )}
    </div>
  );
}
