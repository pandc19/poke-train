import { describe, expect, it } from 'vitest';
import { describePlan, legalPlan } from '@/lib/ev-plan';

const evs = (hp = 0, attack = 0, defense = 0, specialAttack = 0, specialDefense = 0, speed = 0) => ({
  hp,
  attack,
  defense,
  specialAttack,
  specialDefense,
  speed,
});

describe('legalPlan', () => {
  const current = evs(120, 92, 4);

  it('never goes below the current EVs when they are hard to change', () => {
    expect(legalPlan(evs(0, 252, 0, 0, 0, 252), current, true)).toEqual(evs(120, 252, 4, 0, 0, 134));
  });

  it('caps a stat at 252 and the total at 510', () => {
    const plan = legalPlan(evs(300, 300, 0, 0, 0, 300), null, false);
    expect(Math.max(...Object.values(plan))).toBeLessThanOrEqual(252);
    expect(plan.speed).toBe(252);
    expect(Object.values(plan).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(510);
  });

  it('takes the surplus from the least important stat first', () => {
    const plan = legalPlan(evs(120, 252, 4, 0, 0, 252), evs(120, 92, 4), true, ['attack', 'speed']);
    expect(plan).toEqual(evs(120, 252, 4, 0, 0, 134));
    const other = legalPlan(evs(120, 252, 4, 0, 0, 252), evs(120, 92, 4), true, ['speed', 'attack']);
    expect(other).toEqual(evs(120, 134, 4, 0, 0, 252));
  });

  it('keeps what is trained when the plan already fits', () => {
    expect(legalPlan(current, current, true)).toEqual(current);
  });
});

describe('describePlan', () => {
  it('says what is still to train', () => {
    expect(describePlan(evs(120, 252, 4), evs(120, 92, 4), 'nothing')).toEqual({
      spread: '120 HP / 252 Atk / 4 Def',
      toTrain: '160 Atk',
    });
  });

  it('says nothing is missing when the plan is reached', () => {
    expect(describePlan(evs(120, 92, 4), evs(120, 92, 4), 'nothing').toTrain).toBe('nothing');
  });
});

describe('trainingItemsFor', () => {
  it('counts one vitamin per 10 EVs, rounded up, for each missing stat', async () => {
    const { trainingItemsFor } = await import('@/lib/ev-plan');
    const out = trainingItemsFor(evs(0, 160, 134), false);
    expect(out.map((v) => [v.item, v.stat])).toEqual([
      ['Protein', 'Attack'],
      ['Iron', 'Defense'],
      ['Power Bracer', 'Attack'],
      ['Power Belt', 'Defense'],
    ]);
    expect(out[0].why).toContain('16 × Protein');
    expect(out[1].why).toContain('14 × Iron');
  });
});

describe('bestSources', () => {
  it('puts pure yields first, then early evolution stages, then the biggest yield', async () => {
    const { bestSources } = await import('@/lib/ev-catalog');
    const c = (id: number, stage: number, yields: Record<string, number>) => ({
      id,
      nameEn: `P${id}`,
      nameEs: `P${id}`,
      amount: 0,
      yields,
      national: id,
      stage,
    });
    const out = bestSources(
      [
        c(1, 2, { attack: 3 }),
        c(2, 0, { attack: 1 }),
        c(3, 0, { attack: 1, speed: 1 }),
        c(4, 1, { attack: 2 }),
        c(5, 0, { speed: 3 }),
      ],
      'attack'
    );
    expect(out.map((x) => x.id)).toEqual([2, 4, 1, 3]);
  });
});
