"use client";

import { useEffect, useState } from "react";

function describe(ms: number): string {
  const abs = Math.abs(ms);
  const m = Math.floor(abs / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  let text: string;
  if (d >= 2) text = `${d}d`;
  else if (h >= 1) text = `${h}h ${m % 60}m`;
  else if (m >= 1) text = `${m}m`;
  else text = "under a minute";
  return ms >= 0 ? `in ${text}` : `${text} ago`;
}

/**
 * Relative time ("in 17h 42m", "3d ago") computed in the browser, so the
 * server render stays deterministic. Shows the UTC timestamp until mounted.
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Sync to the browser clock after hydration, then tick every 30 s.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(iso);
  return (
    <time dateTime={iso} title={target.toUTCString()} className={className} suppressHydrationWarning>
      {now == null ? target.toISOString().slice(0, 16).replace("T", " ") + " UTC" : describe(target.getTime() - now)}
    </time>
  );
}
