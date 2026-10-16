import { describe, expect, it } from 'vitest';
import {
  abilityMatters,
  chartFrom,
  defendingTypes,
  minimumMultiplier,
  multiplier,
  rankCounters,
  safetyTier,
  scoreCandidate,
  weaknessTable,
  type BaseStats,
  type Candidate,
  type OpponentInput,
} from '@/lib/battle/counters';
import { BATTLE_TYPES, TYPE_CHART } from './type-chart';

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

  it('puts the safe super-effective hitter before a stronger one that is weak to it', () => {
    const fire = { ...opponent, types: ['fire'] };
    const fireTable = weaknessTable(chart, fire, types);
    // Water is x2 on fire and resists it; the rock one hits as hard but is only neutral on defence.
    const brute = { ...candidate(1, ['rock'], 'rock', 150), stats: { ...stats, attack: 200, specialAttack: 200 } };
    // Strong enough to count as a real hitter (over half of what the brute does).
    const safe = candidate(2, ['water'], 'water', 120);
    const weak = { ...candidate(3, ['grass'], 'rock', 150), types: ['grass'] };
    const ranked = rankCounters(chart, fire, fireTable, [brute, safe, weak], 5);
    expect(ranked.map((c) => safetyTier(c))).toEqual([...ranked.map((c) => safetyTier(c))].sort((a, b) => a - b));
    expect(ranked[0].speciesId).toBe(2);
  });

  it('a faster Pokémon outranks an identical slower one', () => {
    const slow = candidate(1, ['water'], 'water');
    const fast = { ...candidate(2, ['water'], 'water'), stats: { ...stats, speed: 120 } };
    const [first] = rankCounters(chart, { ...opponent, types: ['fire'] }, weaknessTable(chart, { ...opponent, types: ['fire'] }, types), [slow, fast], 5);
    expect(first.speciesId).toBe(2);
    expect(first.faster).toBe(true);
  });

  it('known moves replace its own types when judging the hits a counter takes', () => {
    const dragon = { ...charizard, types: ['dragon'] };
    // Rock hits Dragon neutrally, so both stay in the list.
    const water = candidate(1, ['water'], 'rock');
    const table = weaknessTable(chart, dragon, types);
    // Guessed from its own type: dragon attacks, which nothing here resists or fears.
    const guessed = rankCounters(chart, dragon, table, [water], 5)[0];
    // It was seen using Rock moves; the Water Pokémon takes them neutrally, a Flying one is weak.
    const withMoves = { ...dragon, moveTypes: ['rock'] };
    const flying = { ...candidate(2, ['water'], 'rock'), types: ['flying'] };
    const [a, b] = rankCounters(chart, withMoves, table, [water, flying], 5).sort((x, y) => x.speciesId - y.speciesId);
    expect(guessed.incoming).toBe(1);
    expect(a.incoming).toBe(1);
    expect(b.incoming).toBe(2);
  });
});

describe('Tera raids (real type chart)', () => {
  const steelBoss: OpponentInput = {
    types: ['steel', 'psychic'],
    teraType: 'steel',
    stats: { hp: 80, attack: 135, defense: 130, specialAttack: 95, specialDefense: 90, speed: 70 },
    ability: null,
    // Meteor Mash and Earthquake.
    moveTypes: ['steel', 'ground'],
  };
  const table = weaknessTable(TYPE_CHART, steelBoss, BATTLE_TYPES);
  const mon = (
    id: number,
    monTypes: string[],
    teraType: string | null,
    moves: [string, number][],
    s: Partial<BaseStats> = {}
  ): Candidate => ({
    formId: id,
    speciesId: id,
    types: monTypes,
    teraType,
    stats: { ...stats, ...s },
    moves: moves.map(([type, power], i) => ({ id: id * 10 + i, type, damageClass: 'physical', power, accuracy: 100, known: true })),
  });
  // Archaludon (Tera Fairy): Draco Meteor, Flash Cannon, Thunderbolt; nothing super effective.
  const archaludon = mon(1, ['steel', 'dragon'], 'fairy', [['dragon', 130], ['steel', 80], ['electric', 90]], { specialAttack: 125 });
  // Blaziken (Tera Flying): Flare Blitz, Close Combat, Brave Bird.
  const blaziken = mon(2, ['fire', 'fighting'], 'flying', [['fire', 120], ['fighting', 120], ['flying', 120]]);
  // Rhyperior (Tera Ice): Earthquake, Hammer Arm; Tera Ice is weak to Meteor Mash.
  const rhyperior = mon(3, ['ground', 'rock'], 'ice', [['ground', 100], ['fighting', 100]], { attack: 140 });

  it('reads the built-in chart', () => {
    expect(multiplier(TYPE_CHART, 'dragon', ['steel'])).toBe(0.5);
    expect(multiplier(TYPE_CHART, 'ground', ['fire', 'flying'])).toBe(0);
  });

  it('a Tera opponent has to be hit super effectively', () => {
    expect(minimumMultiplier(steelBoss)).toBe(2);
    expect(minimumMultiplier({ teraType: null })).toBe(1);
    expect(scoreCandidate(TYPE_CHART, steelBoss, table, archaludon)).toBeNull();
  });

  it('only lists moves that work', () => {
    const c = scoreCandidate(TYPE_CHART, steelBoss, table, blaziken)!;
    expect([c.move, ...c.alternatives].every((m) => m.multiplier >= 2)).toBe(true);
    expect(c.alternatives).toHaveLength(1);
  });

  it('judges defence on its Tera type, and before it', () => {
    const b = scoreCandidate(TYPE_CHART, steelBoss, table, blaziken)!;
    expect(b.incomingBase).toBe(2); // Earthquake on Fire/Fighting
    expect(b.incoming).toBe(1); // Tera Flying: immune to Earthquake, Meteor Mash neutral
    const r = scoreCandidate(TYPE_CHART, steelBoss, table, rhyperior)!;
    expect(r.incoming).toBe(2); // Meteor Mash on Tera Ice
  });

  it('puts the one that takes its hits first, and drops the one that cannot hurt it', () => {
    const ranked = rankCounters(TYPE_CHART, steelBoss, table, [archaludon, rhyperior, blaziken], 5);
    expect(ranked.map((c) => c.speciesId)).toEqual([2, 3]);
  });

  it('Tera of one of its own types doubles the same-type bonus', () => {
    const fire = (teraType: string | null) => mon(4, ['fire'], teraType, [['fire', 90]]);
    const plain = scoreCandidate(TYPE_CHART, steelBoss, table, fire(null))!;
    const same = scoreCandidate(TYPE_CHART, steelBoss, table, fire('fire'))!;
    expect(same.score).toBeGreaterThan(plain.score);
  });

  it('gives a game suggestion the Tera type that does best', () => {
    const noTera = { ...blaziken, teraType: undefined };
    const [best] = rankCounters(TYPE_CHART, steelBoss, table, [noTera], 1, BATTLE_TYPES);
    // No single type resists both Meteor Mash and Earthquake. Of those that take both neutrally,
    // Fighting also doubles Close Combat's same-type bonus.
    expect(best.incoming).toBe(1);
    expect(best.teraType).toBe('fighting');
  });

  it('a safe Pokémon that barely hurts it goes behind the ones that hit hard', () => {
    // Resists both attacks (Tera Water + Levitate) but only has a weak Fire move.
    const safeButWeak: Candidate = { ...mon(6, ['water'], 'water', [['fire', 40]]), ability: 'levitate' };
    const strong = mon(7, ['fighting'], 'fighting', [['fighting', 120]], { attack: 150 });
    const ranked = rankCounters(TYPE_CHART, steelBoss, table, [safeButWeak, strong], 5);
    expect(ranked[0].speciesId).toBe(7);
  });

  it('gives a game suggestion the ability that does best', () => {
    // A Dragon/Dark Pokémon is weak to nothing here but Earthquake hits it neutrally; Levitate dodges it.
    const dragon: Candidate = { ...mon(5, ['dark', 'dragon'], 'steel', [['fire', 90]]), abilityOptions: ['levitate'] };
    const [withLevitate] = rankCounters(TYPE_CHART, steelBoss, table, [dragon], 1);
    expect(withLevitate.ability).toBe('levitate');
    expect(withLevitate.incoming).toBe(0.5); // Tera Steel: Meteor Mash resisted, Earthquake dodged
    expect(abilityMatters('levitate')).toBe(true);
    expect(abilityMatters('pressure')).toBe(false);
  });
});
