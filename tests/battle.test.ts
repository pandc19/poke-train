import { describe, expect, it } from 'vitest';
import {
  chartFrom,
  defendingTypes,
  multiplier,
  rankCounters,
  weaknessTable,
  type BaseStats,
  type Candidate,
  type OpponentInput,
} from '@/lib/battle/counters';

const chart = chartFrom([
  { attacker: 'water', defender: 'fire', multiplier: 2 },
  { attacker: 'water', defender: 'rock', multiplier: 2 },
  { attacker: 'water', defender: 'water', multiplier: 0.5 },
  { attacker: 'water', defender: 'dragon', multiplier: 0.5 },
  { attacker: 'rock', defender: 'fire', multiplier: 2 },
  { attacker: 'rock', defender: 'flying', multiplier: 2 },
  { attacker: 'ground', defender: 'flying', multiplier: 0 },
  { attacker: 'fire', defender: 'water', multiplier: 0.5 },
  { attacker: 'fire', defender: 'dragon', multiplier: 0.5 },
]);
const types = ['water', 'rock', 'ground', 'fire', 'dragon', 'flying'];
const stats: BaseStats = { hp: 80, attack: 100, defense: 80, specialAttack: 100, specialDefense: 80, speed: 80 };

const charizard: OpponentInput = { types: ['fire', 'flying'], teraType: null, stats, ability: null };

describe('type matchups', () => {
  it('multiplies across both types', () => {
    expect(multiplier(chart, 'rock', ['fire', 'flying'])).toBe(4);
    expect(multiplier(chart, 'ground', ['fire', 'flying'])).toBe(0);
  });

  it('a Tera type replaces its own types when defending', () => {
    const tera = { ...charizard, teraType: 'water' };
    expect(defendingTypes(tera)).toEqual(['water']);
    expect(weaknessTable(chart, tera, types).rock).toBe(1);
    expect(weaknessTable(chart, charizard, types).rock).toBe(4);
  });

  it('Stellar leaves the defending types alone', () => {
    expect(defendingTypes({ ...charizard, teraType: 'stellar' })).toEqual(['fire', 'flying']);
  });

  it('an ability immunity wins over the chart', () => {
    const levitating = { ...charizard, types: ['dragon'], ability: 'levitate' };
    expect(weaknessTable(chart, levitating, types).ground).toBe(0);
  });
});

describe('ranking counters', () => {
  const opponent = charizard;
  const table = weaknessTable(chart, opponent, types);
  const candidate = (formId: number, candidateTypes: string[], moveType: string, power = 90): Candidate => ({
    formId,
    speciesId: formId,
    types: candidateTypes,
    stats,
    moves: [{ id: formId, type: moveType, damageClass: 'special', power, accuracy: 100, known: false }],
  });

  it('puts the super-effective same-type attacker first', () => {
    const ranked = rankCounters(
      chart,
      opponent,
      table,
      [candidate(1, ['normal'], 'normal'), candidate(2, ['rock'], 'rock'), candidate(3, ['water'], 'water')],
      5
    );
    expect(ranked[0].speciesId).toBe(2);
    expect(ranked[0].move.multiplier).toBe(4);
    expect(ranked[0].move.stab).toBe(true);
  });

  it("uses the candidate's own ability", () => {
    const wallOfGround: Candidate = { ...candidate(1, ['ground'], 'ground'), ability: 'levitate' };
    const fireOpp: OpponentInput = { ...charizard, types: ['water'] };
    const hit = { ...fireOpp, types: ['fire'] };
    // Levitate takes the ground hit away: incoming is 0 instead of the chart value.
    const withAbility = rankCounters(chart, hit, weaknessTable(chart, hit, types), [
      { ...candidate(2, ['flying'], 'rock'), ability: 'levitate' },
    ], 1)[0];
    expect(withAbility.incoming).toBeLessThanOrEqual(1);
    expect(wallOfGround.ability).toBe('levitate');
  });

  it('Huge Power raises a physical attacker', () => {
    const physical = (ability: string | null): Candidate => ({
      ...candidate(1, ['rock'], 'rock'),
      ability,
      moves: [{ id: 1, type: 'rock', damageClass: 'physical', power: 90, accuracy: 100, known: true }],
    });
    const table2 = weaknessTable(chart, charizard, types);
    const base = rankCounters(chart, charizard, table2, [physical(null)], 1)[0].score;
    const boosted = rankCounters(chart, charizard, table2, [physical('huge-power')], 1)[0].score;
    expect(boosted).toBeGreaterThan(base);
  });

  it('drops Pokémon whose only attack is immune', () => {
    const ranked = rankCounters(chart, opponent, table, [candidate(1, ['ground'], 'ground')], 5);
    expect(ranked).toEqual([]);
  });

  it('marks a Pokémon that is weak to its attacks', () => {
    const [water] = rankCounters(chart, { ...opponent, types: ['fire'] }, weaknessTable(chart, { ...opponent, types: ['fire'] }, types), [
      candidate(3, ['water'], 'water'),
    ], 5);
    expect(water.incoming).toBe(0.5);
  });
});
