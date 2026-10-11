import { prisma } from './db';
import { LOCAL_USER_ID } from './constants';
import { getGame } from './games';
import { rosterProgress } from './roster-status';

export type DexCell = {
  speciesId: number;
  entryNumber: number;
  nameEn: string;
  nameEs: string;
  spriteUrl: string | null;
  types: string[];
  /** Caught in the profile being viewed (always false on the National Dex). */
  caught: boolean;
  /** Short names of the *other* games where this species is already caught. */
  caughtIn: string[];
  /** Trained-roster badge: in the roster and still pending, or fully trained. */
  roster: 'none' | 'pending' | 'done';
};

/**
 * Builds one Pokédex page. Caught state lives in a single place
 * (PokedexEntry, per profile); this reads it across all of the user's
 * profiles, which is what links the regional dexes to the National Dex.
 *
 * @param profileId the profile being viewed, or null for the National Dex.
 */
export async function loadDex(pokedexSlug: string, profileId: string | null): Promise<DexCell[]> {
  const [slots, entries, roster] = await Promise.all([
    prisma.pokedexSlot.findMany({
      where: { pokedex: { slug: pokedexSlug } },
      orderBy: { entryNumber: 'asc' },
      select: {
        entryNumber: true,
        species: {
          select: {
            id: true,
            nameEn: true,
            nameEs: true,
            forms: { where: { isDefault: true }, select: { spriteUrl: true, types: true }, take: 1 },
          },
        },
      },
    }),
    prisma.pokedexEntry.findMany({
      where: { profile: { userId: LOCAL_USER_ID } },
      select: { speciesId: true, profileId: true, profile: { select: { gameId: true } } },
    }),
    prisma.rosterPokemon.findMany({
      where: profileId ? { profileId } : { profile: { userId: LOCAL_USER_ID } },
      include: { moves: true },
    }),
  ]);

  const caughtHere = new Set<number>();
  const caughtIn = new Map<number, Set<string>>();
  for (const e of entries) {
    if (e.profileId === profileId) {
      caughtHere.add(e.speciesId);
      continue;
    }
    const name = getGame(e.profile.gameId)?.shortName ?? e.profile.gameId;
    if (!caughtIn.has(e.speciesId)) caughtIn.set(e.speciesId, new Set());
    caughtIn.get(e.speciesId)!.add(name);
  }

  const rosterState = new Map<number, 'pending' | 'done'>();
  for (const p of roster) {
    const complete = rosterProgress(p).complete;
    if (!complete || !rosterState.has(p.speciesId)) rosterState.set(p.speciesId, complete ? 'done' : 'pending');
  }

  return slots.map((s) => ({
    speciesId: s.species.id,
    entryNumber: s.entryNumber,
    nameEn: s.species.nameEn,
    nameEs: s.species.nameEs,
    spriteUrl: s.species.forms[0]?.spriteUrl ?? null,
    types: s.species.forms[0]?.types ?? [],
    caught: caughtHere.has(s.species.id),
    caughtIn: [...(caughtIn.get(s.species.id) ?? [])],
    roster: rosterState.get(s.species.id) ?? 'none',
  }));
}
