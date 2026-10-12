import { potentialLevel, type PotentialValue } from './potential';
import type { EvSpread } from './import/evs';

/**
 * What the in-game Judge says about each stat's IV, best last. Each word stands
 * for a band of IV values; "Inmejorable" is exactly 31. In the Spanish (Spain)
 * game the words are the ones in `labelEs`.
 */
export const IV_RATINGS = [
  { value: 'ZERO', label: 'No good', labelEs: 'Cojea un poco', low: 0, high: 0 },
  { value: 'LOW', label: 'Decent', labelEs: 'No está mal', low: 1, high: 15 },
  { value: 'MEDIUM', label: 'Pretty good', labelEs: 'Notable', low: 16, high: 25 },
  { value: 'HIGH', label: 'Very good', labelEs: 'Genial', low: 26, high: 29 },
  { value: 'GREAT', label: 'Fantastic', labelEs: 'Espectacular', low: 30, high: 30 },
  { value: 'PERFECT', label: 'Best', labelEs: 'Inmejorable', low: 31, high: 31 },
] as const;

export type IvRatingValue = (typeof IV_RATINGS)[number]['value'];
export const IV_RATING_VALUES = IV_RATINGS.map((r) => r.value) as [IvRatingValue, ...IvRatingValue[]];

/** A rating per stat. A stat left out (or null) has not been judged. */
export type IvRatings = Partial<Record<keyof EvSpread, IvRatingValue | null>>;

const STAT_KEYS: (keyof EvSpread)[] = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];

export const ivRating = (value: string | null | undefined) => IV_RATINGS.find((r) => r.value === value) ?? null;

/**
 * The IV range one stat can have. A judged stat is the band of its rating; an
 * unjudged one can be anything from `fallbackLow` (what its overall potential
 * allows, or 31 when nothing is known) up to 31.
 */
export function ivBoundsFor(
  ratings: IvRatings | null | undefined,
  key: keyof EvSpread,
  fallbackLow = 31
): { low: number; high: number } {
  const rating = ivRating(ratings?.[key]);
  return rating ? { low: rating.low, high: rating.high } : { low: fallbackLow, high: 31 };
}

/** The six IVs added together, as a range, and whether every stat has been judged. */
export function totalIvRange(ratings: IvRatings | null | undefined): { low: number; high: number; complete: boolean } {
  let low = 0;
  let high = 0;
  let complete = true;
  for (const key of STAT_KEYS) {
    const rating = ivRating(ratings?.[key]);
    if (!rating) {
      complete = false;
      high += 31;
    } else {
      low += rating.low;
      high += rating.high;
    }
  }
  return { low, high, complete };
}

// The overall potential covers a band of the total, out of 186.
const POTENTIAL_TOTALS: { value: PotentialValue; low: number; high: number }[] = [
  { value: 'DECENT', low: 0, high: 90 },
  { value: 'ABOVE_AVERAGE', low: 91, high: 120 },
  { value: 'RELATIVELY_SUPERIOR', low: 121, high: 150 },
  { value: 'OUTSTANDING', low: 151, high: 186 },
];

/**
 * The overall potential the six ratings imply, but only when it is certain:
 * every stat judged and the whole possible total inside one potential band.
 * Otherwise null, and the player's own entry (or none) stands.
 */
export function potentialFromRatings(ratings: IvRatings | null | undefined): PotentialValue | null {
  const total = totalIvRange(ratings);
  if (!total.complete) return null;
  const band = POTENTIAL_TOTALS.find((b) => total.low >= b.low && total.high <= b.high);
  return band && potentialLevel(band.value) ? band.value : null;
}
