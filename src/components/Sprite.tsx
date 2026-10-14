/**
 * Sprites come straight from PokéAPI's GitHub CDN as tiny PNGs, so a plain
 * lazy <img> is used rather than next/image's optimizer.
 */
export function Sprite({
  src,
  alt,
  size = 64,
  silhouette = false,
  smooth = false,
}: {
  src: string | null;
  alt: string;
  size?: number;
  silhouette?: boolean;
  /** Scaled smoothly instead of as crisp pixels: for a sprite shown smaller than it is drawn. */
  smooth?: boolean;
}) {
  if (!src) {
    return (
      <span
        className="grid place-items-center rounded-full bg-surface-2 text-muted"
        style={{ width: size, height: size }}
      >
        ?
      </span>
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
      draggable={false}
      className={`sprite shrink-0 select-none ${smooth ? 'sprite-smooth' : ''} ${silhouette ? 'sprite-silhouette' : ''}`}
    />
  );
}
