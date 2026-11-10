"use client";

// The last 10 searches, kept in localStorage (docs/DECISIONS.md > Pages > Home).
// Every access is guarded: storage can be blocked or unavailable.

import { useSyncExternalStore } from "react";

export type RecentKind = "clan" | "player" | "clanSearch";

export interface RecentEntry {
  kind: RecentKind;
  /** Tag for clan/player, query string for a clan search. */
  key: string;
  label: string;
  at: number;
}

const STORAGE_KEY = "wrs:recent";
const MAX = 10;
const EVENT = "wrs:recent-change";
const EMPTY: RecentEntry[] = [];

let cachedRaw: string | null = null;
let cachedList: RecentEntry[] = EMPTY;

function read(): RecentEntry[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed)
      ? parsed
          .filter(
            (e): e is RecentEntry =>
              !!e &&
              typeof e === "object" &&
              ["clan", "player", "clanSearch"].includes((e as RecentEntry).kind) &&
              typeof (e as RecentEntry).key === "string" &&
              typeof (e as RecentEntry).label === "string",
          )
          .slice(0, MAX)
      : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function write(next: RecentEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage unavailable (private mode, quota); recent searches are optional.
  }
}

export function addRecent(entry: Omit<RecentEntry, "at">): void {
  write(
    [{ ...entry, at: Date.now() }, ...read().filter((e) => !(e.kind === entry.kind && e.key === entry.key))].slice(0, MAX),
  );
}

/** Removes one entry; entries are unique by kind and key. */
export function removeRecent(kind: RecentKind, key: string): void {
  write(read().filter((e) => !(e.kind === kind && e.key === key)));
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // ignore
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useRecent(): RecentEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
