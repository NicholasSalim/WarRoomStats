"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** "20d 14h 03m 22s" until `ms` runs out; days are dropped once under a day. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

/**
 * "in 20d 14h 03m 22s (Dec 1, 2026)", ticking every second from the browser
 * clock. Until mounted (and in the cached server render) it shows
 * "on Dec 1, 2026", so it never goes stale.
 */
export function CountdownClock({ iso, date }: { iso: string; date: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now == null ? null : new Date(iso).getTime() - now;
  return (
    <time dateTime={iso} className="tabular-nums">
      {left == null ? `on ${date}` : left > 0 ? `in ${formatCountdown(left)} (${date})` : `now (${date})`}
    </time>
  );
}
