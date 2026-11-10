import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Compact search bar: a name or a tag (with or without #). A plain GET form;
 * the target page tells names and tags apart.
 */
export function SearchBar({
  action,
  label,
  defaultValue = "",
}: {
  action: "/search" | "/search/players";
  label: string;
  defaultValue?: string;
}) {
  return (
    <form action={action} method="get" role="search" className="flex w-full gap-2">
      <Input
        name="name"
        defaultValue={defaultValue}
        maxLength={50}
        placeholder={label}
        aria-label={label}
        autoComplete="off"
        required
        className="h-10"
      />
      <Button type="submit" className="h-10 px-4">
        <Search aria-hidden /> Search
      </Button>
    </form>
  );
}

export function ClanSearchBar({ defaultValue }: { defaultValue?: string }) {
  return <SearchBar action="/search" label="Clan name or tag" defaultValue={defaultValue} />;
}

export function PlayerSearchBar({ defaultValue }: { defaultValue?: string }) {
  return <SearchBar action="/search/players" label="Player tag" defaultValue={defaultValue} />;
}
