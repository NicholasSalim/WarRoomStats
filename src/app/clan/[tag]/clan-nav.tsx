"use client";

import { Eye, History, Landmark, Medal, Swords } from "lucide-react";
import { SectionTabs, type SectionTab } from "@/components/section-tabs";

const TABS: SectionTab[] = [
  { path: "", label: "Overview", icon: Eye },
  { path: "/war", label: "Current war", icon: Swords },
  { path: "/cwl", label: "CWL", icon: Medal },
  { path: "/warlog", label: "War log", icon: History },
  { path: "/raids", label: "Raids", icon: Landmark },
];

/** Clan section tabs, each its own route under /clan/{slug}. */
export function ClanNav({ slug }: { slug: string }) {
  return <SectionTabs label="Clan sections" base={`/clan/${slug}`} tabs={TABS} />;
}
