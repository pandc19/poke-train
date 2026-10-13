import type { EvSpread } from './import/evs';
import { ivBoundsFor, type IvRatings } from './iv-ratings';

/** The stat a nature raises or lowers, as PokéAPI names it ("special-attack"). */
export type NatureEffect = { increased: string | null; decreased: string | null } | null;

const KEY_OF: Record<string, keyof EvSpread> = {
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'specialAttack',
  'special-defense': 'specialDefense',
  speed: 'speed',
};

const multiplier = (key: keyof EvSpread, nature: NatureEffect): number => {
  if (!nature || key === 'hp') return 1;
  if (nature.increased && KEY_OF[nature.increased] === key) return 1.1;
  if (nature.decreased && KEY_OF[nature.decreased] === key) return 0.9;
  return 1;
};

/** The stat the games show for given base stat, IV, EV, level and nature (generation 3 and later). */
export function statValue(
  key: keyof EvSpread,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: NatureEffect
): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (key === 'hp') return core + level + 10;
  return Math.floor((core + 5) * multiplier(key, nature));
}

/**
 * Works backwards from the stats the game shows to the EVs behind them.
 *
 * The stat depends on IVs too, which are not visible, so perfect IVs (31) are
 * assumed. A Pokémon with lower IVs has more EVs than this says; the result is
 * the smallest spread that produces the stat. Below level 100 several EVs can
 * give the same stat, and the smallest is returned, except a stat at its
 * maximum, which reads as 252. Values are multiples of 4
 * (only each 4 EVs add a point) and never above 252.
 */
export function estimateEvs(args: {
  stats: EvSpread;
  level: number;
  baseStats: EvSpread;
  nature: NatureEffect;
  /** One IV for every stat, or an IV per stat (31 for any left out). */
  ivs?: number | Partial<Record<keyof EvSpread, number>>;
}): EvSpread {
  const { stats, level, baseStats, nature, ivs = 31 } = args;
  const out: EvSpread = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
  (Object.keys(out) as (keyof EvSpread)[]).forEach((key) => {
    const target = stats[key];
    if (!target) return;
    const iv = typeof ivs === 'number' ? ivs : (ivs[key] ?? 31);
    // A stat at its maximum for this level has 252 EVs: below level 100 a few
    // fewer give the same number, but the stat could not tell them apart and
    // the game shows it as full.
    if (statValue(key, baseStats[key], iv, 252, level, nature) <= target) {
      out[key] = 252;
      return;
    }
    // Smallest number of 4-EV steps that makes the shown stat.
    for (let steps = 0; steps <= 63; steps++) {
      if (statValue(key, baseStats[key], iv, steps * 4, level, nature) >= target) {
        out[key] = steps * 4;
        return;
      }
    }
    out[key] = 252;
  });
  return out;
}

export const MAX_EV_TOTAL = 510;

/**
 * Adds EVs the stats cannot show (a few EVs below the point where a stat
 * moves) to a spread worked out from the stats. A stat never goes past 252 and
 * the total never past 510, as in the game: what does not fit is dropped.
 */
export function addHiddenEvs(spread: EvSpread, hidden: Partial<EvSpread> | null | undefined): EvSpread {
  if (!hidden) return spread;
  const out = { ...spread };
  let room = MAX_EV_TOTAL - (Object.values(out) as number[]).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(out) as (keyof EvSpread)[]) {
    const extra = Math.max(0, Math.min(hidden[key] ?? 0, 252 - out[key], room));
    out[key] += extra;
    room -= extra;
  }
  return out;
}

/**
 * The fewest EVs that fit the stats (`estimate`) and the most they could be
 * (`high`).
 *
 * Each stat's IV is what the Judge said about it: a judged stat is held to its
 * band ("Inmejorable" is exactly 31, so its EVs are exact), an unjudged one can
 * be anywhere from `ivsLow` (what the overall potential allows, 31 when that
 * is unknown) to 31. The fewest EVs assume the highest IV each stat can have,
 * the most assume the lowest. The real EVs are somewhere between the two.
 */
export function estimateEvRange(args: {
  stats: EvSpread;
  level: number;
  baseStats: EvSpread;
  nature: NatureEffect;
  /** The lowest average IV the overall potential allows, for stats not judged. */
  ivsLow: number;
  ratings?: IvRatings | null;
  /** EVs known to be there that the stats do not show; added to both ends. */
  hidden?: Partial<EvSpread> | null;
}): { estimate: EvSpread; high: EvSpread } {
  const { ivsLow, ratings, hidden, ...rest } = args;
  const keys = Object.keys(args.stats) as (keyof EvSpread)[];
  const best: Partial<Record<keyof EvSpread, number>> = {};
  const worst: Partial<Record<keyof EvSpread, number>> = {};
  for (const key of keys) {
    const bounds = ivBoundsFor(ratings, key, ivsLow);
    best[key] = bounds.high;
    worst[key] = bounds.low;
  }
  return {
    estimate: addHiddenEvs(estimateEvs({ ...rest, ivs: best }), hidden),
    high: addHiddenEvs(estimateEvs({ ...rest, ivs: worst }), hidden),
  };
}

/**
 * The stats that are higher than the Pokémon can have at this level, with the
 * most it could have (252 EVs and the best IV its rating allows). That means
 * the level, the base stats or the number typed is wrong, and the EVs shown
 * for such a stat would only be a clamp, not a reading.
 */
export function statsAboveMax(args: {
  stats: EvSpread;
  level: number;
  baseStats: EvSpread;
  nature: NatureEffect;
  ratings?: IvRatings | null;
}): Partial<Record<keyof EvSpread, number>> {
  const { stats, level, baseStats, nature, ratings } = args;
  const out: Partial<Record<keyof EvSpread, number>> = {};
  for (const key of Object.keys(stats) as (keyof EvSpread)[]) {
    if (!stats[key]) continue;
    const max = statValue(key, baseStats[key], ivBoundsFor(ratings, key).high, 252, level, nature);
    if (stats[key] > max) out[key] = max;
  }
  return out;
}
