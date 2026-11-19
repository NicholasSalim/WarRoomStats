import { cn } from "@/lib/utils";

// Styling for segmented controls: the pill-shaped switches used as tabs
// (search type, battle type) and as links (leaderboard boards). The markup
// differs (buttons with state vs links), so only the look is shared.

export const SEGMENTED = "inline-flex rounded-lg bg-muted p-1 text-sm";

export function segmentClass(active: boolean): string {
  return cn(
    "rounded-md px-3 py-1.5 transition-colors",
    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
  );
}
