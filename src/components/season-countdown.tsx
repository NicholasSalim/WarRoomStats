import { CalendarClock } from "lucide-react";
import { CountdownClock } from "@/components/countdown-clock";
import { RelativeTime } from "@/components/relative-time";
import { getGoldPassSeason } from "@/lib/coc/client";
import { parseApiTime } from "@/lib/coc/stats";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * When the monthly (Gold Pass) season ends, when season challenges and clan
 * donation counts reset. The block version ticks every second ("Season ends
 * in 20d 14h 03m 22s"); the inline one is coarser ("in 20d"). Renders
 * nothing if the API call fails, since it's only a hint.
 */
export async function SeasonCountdown({ className, inline = false }: { className?: string; inline?: boolean }) {
  const result = await getGoldPassSeason();
  if (!result.ok) return null;
  const end = parseApiTime(result.data.endTime);
  if (!end) return null;
  if (inline) {
    return (
      <span className={className}>
        Season ends <RelativeTime iso={end.toISOString()} /> ({fmtDate(end)}).
      </span>
    );
  }
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-sm text-muted-foreground", className)}>
      <CalendarClock className="size-4" aria-hidden />
      <span>
        Season ends <CountdownClock iso={end.toISOString()} date={fmtDate(end)} />
      </span>
    </p>
  );
}
