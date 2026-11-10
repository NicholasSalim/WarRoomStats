"use client";

import Form from "next/form";
import { Suspense, use, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { MAX_LABELS } from "@/lib/coc/clan-search";
import type { ApiResult } from "@/lib/coc/errors";
import { BadgeImage } from "@/components/badge-image";
import type { Label, Location } from "@/lib/coc/schemas";
import { cn } from "@/lib/utils";

type Mode = "clan" | "player";

export function SearchPanel({
  locations,
  labels,
}: {
  locations: Promise<ApiResult<Location[]>>;
  labels: Promise<ApiResult<Label[]>>;
}) {
  const [mode, setMode] = useState<Mode>("clan");
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div role="tablist" aria-label="Search type" className="mb-5 inline-flex rounded-lg bg-muted p-1 text-sm">
        {(
          [
            ["clan", "Find a clan"],
            ["player", "Find a player"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "clan" ? <ClanSearchForm locations={locations} labels={labels} /> : <PlayerSearchForm />}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function ClanSearchForm({
  locations,
  labels,
}: {
  locations: Promise<ApiResult<Location[]>>;
  labels: Promise<ApiResult<Label[]>>;
}) {
  return (
    <Form action="/search" className="space-y-4">
      <div className="flex gap-2">
        {/* A name (3+ letters) or a tag; /search tells them apart. */}
        <Input
          name="name"
          maxLength={50}
          placeholder="Clan name or tag"
          aria-label="Clan name or tag"
          autoComplete="off"
          className="h-10"
        />
        <Button type="submit" className="h-10 px-4">
          <Search aria-hidden /> Search
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="War frequency" htmlFor="warFrequency">
          <NativeSelect id="warFrequency" name="warFrequency" defaultValue="">
            <option value="">Any</option>
            <option value="always">Always</option>
            <option value="moreThanOncePerWeek">Twice a week</option>
            <option value="oncePerWeek">Once a week</option>
            <option value="lessThanOncePerWeek">Rarely</option>
            <option value="never">Never</option>
          </NativeSelect>
        </Field>
        <Field label="Location" htmlFor="locationId">
          <Suspense
            fallback={
              <NativeSelect id="locationId" name="locationId" disabled>
                <option>Any</option>
              </NativeSelect>
            }
          >
            <LocationOptions locations={locations} />
          </Suspense>
        </Field>
        <Field label="Min. members" htmlFor="minMembers">
          <Input id="minMembers" name="minMembers" type="number" inputMode="numeric" min={2} max={50} placeholder="Any" className="h-9" />
        </Field>
        <Field label="Min. clan level" htmlFor="minClanLevel">
          <Input id="minClanLevel" name="minClanLevel" type="number" inputMode="numeric" min={2} max={50} placeholder="Any" className="h-9" />
        </Field>
      </div>
      <Suspense fallback={null}>
        <LabelPicker labels={labels} />
      </Suspense>
    </Form>
  );
}

function LocationOptions({ locations }: { locations: Promise<ApiResult<Location[]>> }) {
  const result = use(locations);
  const items = result.ok ? result.data : [];
  const countries = items.filter((l) => l.isCountry);
  const regions = items.filter((l) => !l.isCountry);
  return (
    <NativeSelect id="locationId" name="locationId" defaultValue="">
      <option value="">Any</option>
      {regions.length > 0 && (
        <optgroup label="Regions">
          {regions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </optgroup>
      )}
      {countries.length > 0 && (
        <optgroup label="Countries">
          {countries.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </optgroup>
      )}
    </NativeSelect>
  );
}

/** Label chips (checkboxes named labelIds). A name isn't needed once a label is picked. */
function LabelPicker({ labels }: { labels: Promise<ApiResult<Label[]>> }) {
  const result = use(labels);
  const [picked, setPicked] = useState<number[]>([]);
  if (!result.ok || result.data.length === 0) return null;
  const full = picked.length >= MAX_LABELS;
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs text-muted-foreground">
        Labels <span className="text-muted-foreground/70">(up to {MAX_LABELS}; a name or tag is optional once you pick one)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {result.data.map((l) => {
          const on = picked.includes(l.id);
          return (
            <label
              key={l.id}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
                on ? "border-foreground/60 bg-muted text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                !on && full && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="checkbox"
                name="labelIds"
                value={l.id}
                checked={on}
                disabled={!on && full}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, l.id] : p.filter((id) => id !== l.id)))}
                className="sr-only"
              />
              <BadgeImage src={l.iconUrls?.small} alt="" size={16} />
              {l.name}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Player tag only: the API has no player name search. */
function PlayerSearchForm() {
  return (
    <Form action="/search/players" className="space-y-3">
      <div className="flex gap-2">
        <Input
          name="name"
          required
          maxLength={50}
          placeholder="Player tag, e.g. #2PP"
          aria-label="Player tag"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby="player-help"
          autoComplete="off"
          className="h-10 font-mono"
        />
        <Button type="submit" className="h-10 px-4">
          <Search aria-hidden /> Search
        </Button>
      </div>
      <p id="player-help" className="text-xs text-muted-foreground">
        The tag is under the player&apos;s name on their in-game profile. The # is optional.
      </p>
    </Form>
  );
}
