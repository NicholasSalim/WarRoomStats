"use client";

import { Eye, Landmark, Shield, Star, Swords, TrendingUp, Trophy } from "lucide-react";
import { SectionTabs, type SectionTab } from "@/components/section-tabs";

const TABS: SectionTab[] = [
  { path: "", label: "Overview", icon: Eye },
  { path: "/ranked", label: "Ranked", icon: Trophy, also: ["/season"] },
  { path: "/battles", label: "Battle log", icon: Swords },
  { path: "/wars", label: "Wars", icon: Shield },
  { path: "/raids", label: "Raids", icon: Landmark },
  { path: "/progress", label: "Progress", icon: TrendingUp },
  { path: "/achievements", label: "Achievements", icon: Star },
];

/** Player section tabs, each its own route under /player/{slug}. */
export function PlayerNav({ slug }: { slug: string }) {
  return <SectionTabs label="Player sections" base={`/player/${slug}`} tabs={TABS} />;
}
