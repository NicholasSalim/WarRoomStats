import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { Army, ArmyHero, ArmyPart, ArmyUnit } from "@/lib/coc/army";

/** Unit image (served resized by next/image); the name is the alt text and tooltip. */
function UnitIcon({ src, name, size }: { src: string; name: string; size: number }) {
  return (
    <Image src={src} alt={name} title={name} width={size} height={size} className="shrink-0 rounded-md object-contain" style={{ width: size, height: size }} />
  );
}

function Chips({ title, units }: { title: string; units: ArmyUnit[] }) {
  if (units.length === 0) return null;
  return (
    <div className="space-y-1">
      <h5 className="text-xs text-muted-foreground">{title}</h5>
      <ul className="flex flex-wrap gap-1.5">
        {units.map((u, i) =>
          u.icon ? (
            <li key={`${u.id}-${i}`} className="relative rounded-md border border-border bg-card">
              <UnitIcon src={u.icon} name={u.name} size={44} />
              <span className="tabular absolute right-0.5 bottom-0.5 rounded bg-black/80 px-1 text-[11px] leading-4 font-semibold text-white">
                {u.count}
              </span>
            </li>
          ) : (
            <li key={`${u.id}-${i}`} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
              <span className="tabular font-semibold">{u.count}×</span>
              <span>{u.name}</span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function initials(name: string): string {
  if (/#\d+$/.test(name)) return "?"; // unknown id placeholder, e.g. "Pet #12"
  return name
    .split(/[\s.#]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function HeroTile({ hero }: { hero: ArmyHero }) {
  const parts = [hero.pet, ...hero.equipment].filter((p): p is ArmyPart => !!p);
  if (hero.icon) {
    // Pet and equipment without an image get a small lettered tile with the name as tooltip.
    return (
      <li className="flex items-center gap-1 rounded-md border border-border bg-card p-1" aria-label={[hero.name, ...parts.map((p) => p.name)].join(", ")}>
        <UnitIcon src={hero.icon} name={hero.name} size={44} />
        {parts.length > 0 && (
          <span className="grid grid-cols-2 gap-0.5">
            {parts.map((p, i) =>
              p.icon ? (
                <UnitIcon key={`${p.name}-${i}`} src={p.icon} name={p.name} size={21} />
              ) : (
                <span
                  key={`${p.name}-${i}`}
                  title={p.name}
                  className="flex size-5.25 items-center justify-center rounded-md bg-secondary text-[9px] font-semibold text-muted-foreground"
                >
                  {initials(p.name)}
                </span>
              ),
            )}
          </span>
        )}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs">
      {hero.icon && <UnitIcon src={hero.icon} name={hero.name} size={28} />}
      <span>
        <span className="font-medium">{hero.name}</span>
        {parts.length > 0 && <span className="block text-muted-foreground">{parts.map((p) => p.name).join(" · ")}</span>}
      </span>
    </li>
  );
}

/** The army a battle used, decoded from its share code, with the in-game copy link. */
export function ArmyView({
  army,
  armyLink,
  attack,
  opponentName,
}: {
  army: Army | null;
  armyLink: string | null;
  attack: boolean;
  opponentName: string;
}) {
  const owner = attack ? "Army used" : `Army used by ${opponentName}`;
  if (!army) {
    return (
      <div className="space-y-1">
        <h4 className="text-xs text-muted-foreground">{owner}</h4>
        <p className="text-muted-foreground">Not available for this battle.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs text-muted-foreground">{owner}</h4>
        {armyLink && (
          <a
            href={armyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Open army in game <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
      {army.heroes.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-xs text-muted-foreground">Heroes</h5>
          <ul className="flex flex-wrap gap-1.5">
            {army.heroes.map((h, i) => (
              <HeroTile key={`${h.id}-${i}`} hero={h} />
            ))}
          </ul>
        </div>
      )}
      <Chips title="Troops" units={army.troops} />
      <Chips title="Spells" units={army.spells} />
      <Chips title="Clan Castle" units={[...army.castleTroops, ...army.castleSpells]} />
    </div>
  );
}
