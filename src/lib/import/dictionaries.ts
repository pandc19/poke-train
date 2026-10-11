import { prisma } from '../db';
import type { Dictionaries } from './interpret';
import { ALIASES, createMatcher } from './matcher';

const named = { id: true, slug: true, nameEn: true, nameEs: true } as const;

/** Loads the name dictionaries the importer resolves against. */
export async function loadDictionaries(): Promise<Dictionaries> {
  const [species, moves, items, abilities, natures] = await Promise.all([
    prisma.species.findMany({ select: named, orderBy: { id: 'asc' } }),
    prisma.move.findMany({ select: named, orderBy: { id: 'asc' } }),
    prisma.item.findMany({ select: named, orderBy: { id: 'asc' } }),
    prisma.ability.findMany({ select: named, orderBy: { id: 'asc' } }),
    prisma.nature.findMany({ select: named, orderBy: { id: 'asc' } }),
  ]);
  const byId = new Map(species.map((s) => [s.id, s]));
  return {
    species: createMatcher(species, ALIASES.species),
    speciesById: (id) => {
      const s = byId.get(id);
      return s ? { ...s, exact: true } : null;
    },
    moves: createMatcher(moves, ALIASES.moves),
    items: createMatcher(items, ALIASES.items),
    abilities: createMatcher(abilities, ALIASES.abilities),
    natures: createMatcher(natures, ALIASES.natures),
  };
}
