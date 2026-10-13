import { describe, expect, it } from 'vitest';
import { genderOf, rosterGenderToPokedex, sidesOf } from '@/lib/gender-sync';

describe('gender sides', () => {
  it('reads which genders a recorded gender stands for', () => {
    expect(sidesOf('MALE')).toEqual({ male: true, female: false });
    expect(sidesOf('FEMALE')).toEqual({ male: false, female: true });
    expect(sidesOf('BOTH')).toEqual({ male: true, female: true });
    expect(sidesOf('UNKNOWN')).toEqual({ male: false, female: false });
    expect(sidesOf('GENDERLESS')).toEqual({ male: false, female: false });
  });

  it('turns sides back into a recorded gender', () => {
    expect(genderOf({ male: true, female: true }, 'UNKNOWN')).toBe('BOTH');
    expect(genderOf({ male: true, female: false }, 'UNKNOWN')).toBe('MALE');
    expect(genderOf({ male: false, female: true }, 'BOTH')).toBe('FEMALE');
    expect(genderOf({ male: false, female: false }, 'BOTH')).toBe('UNKNOWN');
  });

  it('never turns a genderless Pokémon into an unknown one', () => {
    expect(genderOf({ male: false, female: false }, 'GENDERLESS')).toBe('GENDERLESS');
  });
});

describe('roster gender to the Pokédex', () => {
  type Entry = { hasMale: boolean; hasFemale: boolean };
  /** A tiny stand-in for the database: one species, one Pokédex entry, some other roster Pokémon. */
  function fakeDb(entry: Entry | null, others: ('MALE' | 'FEMALE')[] = []) {
    const state = { entry };
    const db = {
      species: { findUnique: async () => ({ genderRate: 4 }) },
      pokedexEntry: {
        findUnique: async () => state.entry,
        upsert: async ({ update, create }: { update: Partial<Entry>; create: Partial<Entry> }) => {
          state.entry = state.entry
            ? { ...state.entry, ...update }
            : { hasMale: create.hasMale ?? false, hasFemale: create.hasFemale ?? false };
        },
        updateMany: async ({ data }: { data: Partial<Entry> }) => {
          if (state.entry) state.entry = { ...state.entry, ...data };
        },
      },
      rosterPokemon: { findMany: async () => others.map((gender) => ({ gender })) },
    };
    return { db: db as unknown as Parameters<typeof rosterGenderToPokedex>[0], state };
  }
  const args = (before: 'MALE' | 'FEMALE' | 'UNKNOWN', after: 'MALE' | 'FEMALE' | 'UNKNOWN') => ({
    profileId: 'p',
    speciesId: 1,
    rosterId: 'r',
    before,
    after,
  });

  it('carries a change of gender over when the Pokédex has only that one', async () => {
    const { db, state } = fakeDb({ hasMale: true, hasFemale: false });
    await rosterGenderToPokedex(db, args('MALE', 'FEMALE'));
    expect(state.entry).toEqual({ hasMale: false, hasFemale: true });
  });

  it('leaves the Pokédex alone when it already has both genders', async () => {
    const { db, state } = fakeDb({ hasMale: true, hasFemale: true });
    await rosterGenderToPokedex(db, args('MALE', 'FEMALE'));
    expect(state.entry).toEqual({ hasMale: true, hasFemale: true });
  });

  it('keeps a gender another roster Pokémon still has', async () => {
    const { db, state } = fakeDb({ hasMale: true, hasFemale: false }, ['MALE']);
    await rosterGenderToPokedex(db, args('MALE', 'FEMALE'));
    expect(state.entry).toEqual({ hasMale: true, hasFemale: true });
  });

  it('registers the first gender recorded', async () => {
    const { db, state } = fakeDb(null);
    await rosterGenderToPokedex(db, args('UNKNOWN', 'MALE'));
    expect(state.entry).toEqual({ hasMale: true, hasFemale: false });
  });
});
