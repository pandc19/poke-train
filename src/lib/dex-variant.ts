/**
 * A species can sit in two Pokédexes of one game as different forms (Paldea has
 * Dugtrio, Blueberry has Alolan Dugtrio). Caught state is kept per form, as a
 * "variant" on the Pokédex entry: '' for the species' own form, or a region.
 * The Pokédex UI keeps one number per card, so species id and variant are packed into a key.
 */
export const REGIONS = ['alola', 'galar', 'hisui'] as const;
/** Paldean Tauros and Wooper are a form of their own too, apart from the Kanto and Johto ones. */
export const VARIANTS = [...REGIONS, 'paldea'] as const;
export type Variant = '' | (typeof VARIANTS)[number];

// 'paldea' comes last so the keys of the other forms stay as they were.
const CODES: Variant[] = ['', ...VARIANTS];
const STEP = 100000;

/** The regional variant a form slug stands for ('' for any other form). */
export function variantOfSlug(slug: string): Variant {
  // Totem and cap forms are not looks of their own.
  if (/-(cap|totem|zen)(-|$)/.test(slug)) return '';
  return VARIANTS.find((r) => slug.includes(`-${r}`)) ?? '';
}

export const encodeKey = (speciesId: number, variant: Variant): number =>
  speciesId + Math.max(0, CODES.indexOf(variant)) * STEP;

export function decodeKey(key: number): { speciesId: number; variant: Variant } {
  return { speciesId: key % STEP, variant: CODES[Math.floor(key / STEP)] ?? '' };
}
