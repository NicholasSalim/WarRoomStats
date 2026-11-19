import type { Location } from "@/lib/coc/schemas";

/** `<optgroup>`s for a location picker: regions (like Europe) first, then countries. */
export function LocationOptgroups({ locations }: { locations: Location[] }) {
  const groups = [
    ["Regions", locations.filter((l) => !l.isCountry)],
    ["Countries", locations.filter((l) => l.isCountry)],
  ] as const;
  return groups.map(([label, items]) =>
    items.length > 0 ? (
      <optgroup key={label} label={label}>
        {items.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </optgroup>
    ) : null,
  );
}
