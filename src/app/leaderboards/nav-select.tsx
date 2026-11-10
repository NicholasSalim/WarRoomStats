"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { NativeSelect } from "@/components/native-select";

/**
 * A dropdown that navigates to /leaderboards with its value set (and the
 * page reset to 1). Falls back to a plain GET form without JS.
 */
export function NavSelect({
  id,
  label,
  name,
  value,
  params,
  className = "w-56",
  children,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  /** Search params kept on navigation. */
  params: Record<string, string>;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form action="/leaderboards" method="get" className="flex items-center gap-2" aria-busy={pending}>
      {Object.entries(params).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <NativeSelect
        id={id}
        name={name}
        defaultValue={value}
        className={className}
        onChange={(e) => {
          const q = new URLSearchParams({ ...params, [name]: e.target.value });
          startTransition(() => router.push(`/leaderboards?${q}`));
        }}
      >
        {children}
      </NativeSelect>
      <noscript>
        <button type="submit" className="rounded-md border border-border px-2 py-1 text-sm">
          Go
        </button>
      </noscript>
    </form>
  );
}
