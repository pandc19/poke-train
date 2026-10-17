import { describe, expect, it } from 'vitest';
import { IV_STATS, type OwnedPokemon } from '@/lib/breeding/engine';
import { findMatch } from '@/lib/breeding/match';

const perfect = Object.fromEntries(IV_STATS.map((s) => [s, 'perfect'])) as OwnedPokemon['ivs'];
const mine: OwnedPokemon = {
  id: 'a',
  speciesId: 158,
  gender: 'MALE',
  moveIds: [10, 20],
  source: 'roster',
  ivs: perfect,
  natureId: 3,
  hiddenAbility: false,
};
const goal = { speciesId: 158, natureId: 3, ivTargets: [...IV_STATS], moveIds: [10], hiddenAbility: false };

describe('a Pokémon that already matches a plan', () => {
  it('is found when species, nature, IVs and moves all fit', () => {
    expect(findMatch([mine], goal)).toBe(mine);
  });

  it.each([
    ['another nature', { ...mine, natureId: 4 }],
    ['an IV that is not perfect', { ...mine, ivs: { ...perfect, speed: 'imperfect' as const } }],
    ['an IV that was not judged', { ...mine, ivs: { hp: 'perfect' as const } }],
    ['a missing move', { ...mine, moveIds: [20] }],
    ['another species', { ...mine, speciesId: 159 }],
  ])('is not found with %s', (_label, other) => {
    expect(findMatch([other], goal)).toBeUndefined();
  });

  it('needs the hidden ability only when the plan asks for it', () => {
    expect(findMatch([mine], { ...goal, hiddenAbility: true })).toBeUndefined();
    expect(findMatch([{ ...mine, hiddenAbility: true }], { ...goal, hiddenAbility: true })).toBeDefined();
  });

  it('ignores a Pokédex entry, which says nothing about IVs or nature', () => {
    expect(findMatch([{ ...mine, source: 'pokedex', id: undefined }], goal)).toBeUndefined();
  });
});
