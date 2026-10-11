import { prisma } from '../db';
import { LOCAL_USER_ID } from '../constants';
import type { GameConfig } from '../games';
import type { BreedingData, LearnWay, Owned, OwnedPokemon } from './engine';

/** Loads what the engine needs for a set of moves in one game. */
export async function loadBreedingData(game: GameConfig, moveIds: number[]): Promise<BreedingData> {
  const [species, slots, learnsets] = await Promise.all([
    prisma.species.findMany({
      select: { id: true, nameEn: true, nameEs: true, eggGroups: true, genderRate: true, evolvesFromId: true },
    }),
    prisma.pokedexSlot.findMany({ where: { pokedex: { gameId: game.id } }, select: { speciesId: true } }),
    moveIds.length
      ? prisma.learnset.findMany({
          where: { moveId: { in: moveIds }, versionGroup: { in: game.learnsetVersionGroups } },
          select: { moveId: true, method: true, level: true, form: { select: { speciesId: true } } },
        })
      : [],
  ]);

  const available = new Set(slots.map((s) => s.speciesId));
  const learns = new Map<number, Map<number, LearnWay[]>>();
  for (const l of learnsets) {
    const speciesId = l.form.speciesId;
    if (!learns.has(speciesId)) learns.set(speciesId, new Map());
    const byMove = learns.get(speciesId)!;
    if (!byMove.has(l.moveId)) byMove.set(l.moveId, []);
    byMove.get(l.moveId)!.push({ method: l.method, level: l.level });
  }
  return {
    species: new Map(species.map((s) => [s.id, { ...s, available: available.has(s.id) }])),
    learns,
    mirrorHerb: game.features.mirrorHerb,
  };
}

/**
 * What the player has to breed with in this game: the owned roster Pokémon
 * of this profile, plus the genders registered in its Pokédex. A Pokémon
 * that is only registered (it evolved or was released) is not a parent. A species
 * caught with no gender recorded is kept as "unknown", which the planner
 * reports as "caught, check its gender" rather than as a usable parent.
 */
export async function loadOwned(profileId: string): Promise<Owned> {
  const [roster, entries] = await Promise.all([
    prisma.rosterPokemon.findMany({
      where: { profileId, owned: true, profile: { userId: LOCAL_USER_ID } },
      select: {
        speciesId: true,
        gender: true,
        // Only moves already checked off: a pending move is not known yet.
        moves: { where: { status: 'DONE', moveId: { not: null } }, select: { moveId: true } },
      },
    }),
    prisma.pokedexEntry.findMany({
      where: { profileId },
      select: { speciesId: true, hasMale: true, hasFemale: true, owned: true },
    }),
  ]);

  // Registered-only entries (evolved or released) are not in the player's hands.
  const held = entries.filter((e) => e.owned);
  const owned: OwnedPokemon[] = roster.map((p) => ({
    speciesId: p.speciesId,
    gender: p.gender,
    moveIds: p.moves.map((m) => m.moveId!),
  }));
  const inRoster = new Set(roster.map((p) => p.speciesId));
  for (const e of held) {
    if (e.hasMale) owned.push({ speciesId: e.speciesId, gender: 'MALE', moveIds: [] });
    if (e.hasFemale) owned.push({ speciesId: e.speciesId, gender: 'FEMALE', moveIds: [] });
    if (!e.hasMale && !e.hasFemale && !inRoster.has(e.speciesId)) {
      owned.push({ speciesId: e.speciesId, gender: 'UNKNOWN', moveIds: [] });
    }
  }
  return { roster: owned, caughtSpeciesIds: new Set(held.map((e) => e.speciesId)) };
}
