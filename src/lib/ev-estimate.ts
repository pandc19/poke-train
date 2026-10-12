import type { EvSpread } from './import/evs';

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
 * give the same stat, and the smallest is returned. Values are multiples of 4
 * (only each 4 EVs add a point) and never above 252.
 */
export function estimateEvs(args: {
  stats: EvSpread;
  level: number;
  baseStats: EvSpread;
  nature: NatureEffect;
  ivs?: number;
}): EvSpread {
  const { stats, level, baseStats, nature, ivs = 31 } = args;
  const out: EvSpread = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
  (Object.keys(out) as (keyof EvSpread)[]).forEach((key) => {
    const target = stats[key];
    if (!target) return;
    // Smallest number of 4-EV steps that makes the shown stat.
    for (let steps = 0; steps <= 63; steps++) {
      if (statValue(key, baseStats[key], ivs, steps * 4, level, nature) >= target) {
        out[key] = steps * 4;
        return;
      }
    }
    out[key] = 252;
  });
  return out;
}

/**
 * The EVs for the IV the Judge's potential points to, plus the spread they
 * could really be in: with higher IVs it needs fewer EVs for the same stat
 * (`low`), with lower IVs more (`high`).
 */
export function estimateEvRange(args: {
  stats: EvSpread;
  level: number;
  baseStats: EvSpread;
  nature: NatureEffect;
  ivs: { assumed: number; low: number; high: number };
}): { estimate: EvSpread; low: EvSpread; high: EvSpread } {
  const { ivs, ...rest } = args;
  return {
    estimate: estimateEvs({ ...rest, ivs: ivs.assumed }),
    low: estimateEvs({ ...rest, ivs: ivs.high }),
    high: estimateEvs({ ...rest, ivs: ivs.low }),
  };
}
