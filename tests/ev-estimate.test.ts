import { describe, expect, it } from 'vitest';
import { estimateEvs, statValue } from '@/lib/ev-estimate';

// Golem's base stats, and an Adamant nature (+Attack, -Sp. Atk).
const GOLEM = { hp: 80, attack: 120, defense: 130, specialAttack: 55, specialDefense: 65, speed: 45 };
const ADAMANT = { increased: 'attack', decreased: 'special-attack' };

describe('stat formula', () => {
  it('matches known values at level 100 with 31 IVs', () => {
    expect(statValue('hp', 80, 31, 0, 100, null)).toBe(301);
    expect(statValue('hp', 80, 31, 252, 100, null)).toBe(364);
    expect(statValue('attack', 120, 31, 252, 100, ADAMANT)).toBe(Math.floor((276 + 63) * 1.1));
    expect(statValue('specialAttack', 55, 31, 0, 100, ADAMANT)).toBe(131);
  });
});

describe('estimating EVs from stats', () => {
  it('reads the numbers from a real Golem summary (stats, not EVs)', () => {
    const evs = estimateEvs({
      stats: { hp: 331, attack: 328, defense: 297, speed: 126, specialDefense: 166, specialAttack: 131 },
      level: 100,
      baseStats: GOLEM,
      nature: ADAMANT,
    });
    // Mostly HP and Attack, a little Defense, nothing in the rest: what the yellow graph showed.
    expect(evs).toEqual({ hp: 120, attack: 92, defense: 4, specialAttack: 0, specialDefense: 0, speed: 0 });
  });

  it('always finds a spread that makes the same stat, never more than was used', () => {
    for (const ev of [0, 4, 100, 168, 252]) {
      for (const key of ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const) {
        const stat = statValue(key, GOLEM[key], 31, ev, 100, ADAMANT);
        const stats = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, [key]: stat };
        const back = estimateEvs({ stats, level: 100, baseStats: GOLEM, nature: ADAMANT });
        // Same stat; and the smallest such spread, so never above what was really invested.
        expect(statValue(key, GOLEM[key], 31, back[key], 100, ADAMANT)).toBe(stat);
        expect(back[key]).toBeLessThanOrEqual(ev);
      }
    }
  });

  it('is exact where the nature does not scale the stat', () => {
    for (const ev of [0, 4, 100, 168, 252]) {
      for (const key of ['hp', 'defense', 'specialDefense', 'speed'] as const) {
        const stat = statValue(key, GOLEM[key], 31, ev, 100, ADAMANT);
        const stats = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, [key]: stat };
        expect(estimateEvs({ stats, level: 100, baseStats: GOLEM, nature: ADAMANT })[key]).toBe(ev);
      }
    }
  });

  it('never goes past 252 or below 0', () => {
    const evs = estimateEvs({
      stats: { hp: 9999, attack: 1, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      level: 100,
      baseStats: GOLEM,
      nature: null,
    });
    expect(evs.hp).toBe(252);
    expect(evs.attack).toBe(0);
  });

  it('returns the smallest spread when the level makes several EVs give one stat', () => {
    const stat = statValue('speed', 45, 31, 100, 50, null);
    const back = estimateEvs({
      stats: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: stat },
      level: 50,
      baseStats: GOLEM,
      nature: null,
    });
    expect(statValue('speed', 45, 31, back.speed, 50, null)).toBe(stat);
    expect(back.speed).toBeLessThanOrEqual(100);
  });
});
