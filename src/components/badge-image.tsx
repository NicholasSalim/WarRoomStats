import { cn } from "@/lib/utils";

/**
 * Clan badges and league icons served by the game's asset CDN. Rendered with a
 * plain <img> so the asset is shown exactly as published (no re-encoding) and
 * doesn't spend image-optimisation quota.
 */
export function BadgeImage({
  src,
  alt,
  size = 32,
  className,
}: {
  src: string | undefined;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <span
        aria-hidden
        className={cn("inline-block shrink-0 rounded-md bg-muted", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
