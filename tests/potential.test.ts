import { describe, expect, it } from 'vitest';
import { POTENTIAL_LEVELS, potentialLevel } from '@/lib/potential';

describe('Judge potential', () => {
  it('has the four overall levels, lowest first, as the Spanish game words them', () => {
    expect(POTENTIAL_LEVELS.map((l) => l.labelEs)).toEqual([
      'Aceptable',
      'Superior a la media',
      'Notable',
      'Extraordinario',
    ]);
    expect(POTENTIAL_LEVELS.map((l) => l.value)).toEqual([
      'DECENT',
      'ABOVE_AVERAGE',
      'RELATIVELY_SUPERIOR',
      'OUTSTANDING',
    ]);
  });

  it('looks a level up by its stored value, and tolerates nothing', () => {
    expect(potentialLevel('OUTSTANDING')?.labelEs).toBe('Extraordinario');
    expect(potentialLevel(null)).toBeNull();
    expect(potentialLevel('BEST')).toBeNull();
  });
});
