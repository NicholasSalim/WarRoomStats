import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Movement since the API's previous rank: a green up or red down arrow with the distance. */
export function RankChange({ rank, previous, className }: { rank: number; previous?: number; className?: string }) {
  if (!previous || previous <= 0 || previous === rank) return <span className="sr-only">no change</span>;
  const up = previous > rank;
  return (
    <span
      className={cn("inline-flex items-center text-xs", up ? "text-win-foreground" : "text-loss-foreground", className)}
      title={`Previously #${previous}`}
    >
      {up ? <ArrowUp className="size-3" aria-label="up" /> : <ArrowDown className="size-3" aria-label="down" />}
      {Math.abs(previous - rank)}
    </span>
  );
}
