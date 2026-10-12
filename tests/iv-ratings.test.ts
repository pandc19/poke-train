import { describe, expect, it } from 'vitest';
import { estimateEvRange } from '@/lib/ev-estimate';
import { IV_RATINGS, ivBoundsFor, potentialFromRatings, totalIvRange } from '@/lib/iv-ratings';

const GOLEM = { hp: 80, attack: 120, defense: 130, specialAttack: 55, specialDefense: 65, speed: 45 };
const ADAMANT = { increased: 'attack', decreased: 'special-attack' };
const STATS = { hp: 331, attack: 328, defense: 297, speed: 126, specialDefense: 166, specialAttack: 131 };

const allPerfect = { hp: 'PERFECT', attack: 'PERFECT', defense: 'PERFECT', specialAttack: 'PERFECT', specialDefense: 'PERFECT', speed: 'PERFECT' } as const;
// PS, Velocidad, Def. Esp. and At. Esp. Inmejorable; Ataque and Defensa "No está mal".
const second = { ...allPerfect, attack: 'LOW', defense: 'LOW' } as const;

describe('IV ratings as the Spanish game words them', () => {
  it('has the six words and the IV each one stands for', () => {
    expect(IV_RATINGS.map((r) => [r.labelEs, r.low, r.high])).toEqual([
      ['Cojea un poco', 0, 0],
      ['No está mal', 1, 15],
      ['Notable', 16, 25],
      ['Genial', 26, 29],
      ['Espectacular', 30, 30],
      ['Inmejorable', 31, 31],
    ]);
  });

  it('holds a judged stat to its band, and an unjudged one to what is left', () => {
    expect(ivBoundsFor({ hp: 'LOW' }, 'hp')).toEqual({ low: 1, high: 15 });
    expect(ivBoundsFor({}, 'hp')).toEqual({ low: 31, high: 31 });
    expect(ivBoundsFor({}, 'hp', 25)).toEqual({ low: 25, high: 31 });
  });
});

describe('what the ratings say about the total and the potential', () => {
  it('adds the six bands', () => {
    expect(totalIvRange(allPerfect)).toEqual({ low: 186, high: 186, complete: true });
    expect(totalIvRange(second)).toEqual({ low: 126, high: 154, complete: true });
    expect(totalIvRange({ hp: 'PERFECT' }).complete).toBe(false);
  });

  it('names the potential only when it is certain', () => {
    expect(potentialFromRatings(allPerfect)).toBe('OUTSTANDING');
    // 126-154 straddles Notable (121-150) and Extraordinario (151+): not certain.
    expect(potentialFromRatings(second)).toBeNull();
    expect(potentialFromRatings({ hp: 'PERFECT' })).toBeNull();
  });
});

describe('EVs with per-stat IVs', () => {
  const base = { stats: STATS, level: 100, baseStats: GOLEM, nature: ADAMANT, ivsLow: 25 };

  it('is exact when every stat is Inmejorable', () => {
    const { estimate, high } = estimateEvRange({ ...base, ratings: allPerfect });
    expect(estimate).toEqual({ hp: 120, attack: 92, defense: 4, specialAttack: 0, specialDefense: 0, speed: 0 });
    expect(high).toEqual(estimate);
  });

  it('only leaves a range on the stats that were not perfect', () => {
    const { estimate, high } = estimateEvRange({ ...base, ratings: second });
    for (const key of ['hp', 'speed', 'specialDefense', 'specialAttack'] as const) {
      expect(high[key]).toBe(estimate[key]);
    }
    expect(high.attack).toBeGreaterThan(estimate.attack);
    expect(high.defense).toBeGreaterThan(estimate.defense);
  });

  it('fewest EVs for a judged stat assume the top of its band, not 31', () => {
    const perfect = estimateEvRange({ ...base, ratings: allPerfect }).estimate;
    const low = estimateEvRange({ ...base, ratings: second }).estimate;
    // IV at most 15 instead of 31 means more EVs are needed for the same stat.
    expect(low.attack).toBeGreaterThan(perfect.attack);
  });
});
