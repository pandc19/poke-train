import { prisma } from './db';
import { LOCAL_USER_ID } from './constants';
import { NATIONAL_DEX_SLUG, getGame } from './games';
import { exclusiveBySpecies } from './games/exclusives';
import { rosterProgress } from './roster-status';

export type DexCell = {
  speciesId: number;
  entryNumber: number;
  nameEn: string;
  nameEs: string;
  spriteUrl: string | null;
  types: string[];
  /** Caught in the profile being viewed. */
  caught: boolean;
  /** Obtainable in the game being viewed. Always true outside a game's National Dex. */
  inGame: boolean;
  /** Only one version of a paired game has it. `own` is true when it is the player's version. */
  exclusive: { versionName: string; own: boolean } | null;
  /** You have one right now. False on a caught Pokémon means it evolved or was released. */
  owned: boolean;
  /** In your trained roster as obtained. The roster decides, so the Pokédex Have button is locked on. */
  ownedViaRoster: boolean;
  /** The nearest later evolution you have right now, if any: this one probably evolved. */
  evolvedInto: { nameEn: string; nameEs: string } | null;
  /** Genders recorded for this species in the profile being viewed. */
  hasMale: boolean;
  hasFemale: boolean;
  /** Eighths female; -1 = genderless. Gender buttons only matter for mixed species. */
  genderRate: number;
  /** Short names of the *other* games where this species is already caught. */
  caughtIn: string[];
  /** Trained-roster badge: in the roster and still pending, or fully trained. */
  roster: 'none' | 'pending' | 'done';
};

/**
 * Builds one Pokédex page. Caught state lives in a single place
 * (PokedexEntry, per save profile), so a game's regional dexes and its
 * National Dex are two views of the same rows. Other games' saves only
 * contribute the "caught in ..." badges; they never count as caught here.
 *
 * @param profileId the save profile being viewed.
 */
export async function loadDex(
  pokedexSlug: string,
  profileId: string | null,
  opts: { gameId?: string } = {}
): Promise<DexCell[]> {
  const [slots, entries, roster, gameSlots, lines] = await Promise.all([
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
            genderRate: true,
            forms: {
              where: { OR: [{ isDefault: true }, { slug: { contains: '-paldea' } }] },
              select: { slug: true, isDefault: true, spriteUrl: true, types: true },
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    }),
    prisma.pokedexEntry.findMany({
      where: { profile: { userId: LOCAL_USER_ID } },
      select: {
        speciesId: true,
        profileId: true,
        owned: true,
        hasMale: true,
        hasFemale: true,
        profile: { select: { gameId: true } },
      },
    }),
    prisma.rosterPokemon.findMany({
      where: profileId ? { profileId } : { profile: { userId: LOCAL_USER_ID } },
      include: { moves: true },
    }),
    // A game's National Dex lists every species; this marks which ones the game has.
    opts.gameId && pokedexSlug === NATIONAL_DEX_SLUG
      ? prisma.pokedexSlot.findMany({ where: { pokedex: { gameId: opts.gameId } }, select: { speciesId: true } })
      : null,
    prisma.species.findMany({ select: { id: true, evolvesFromId: true, nameEn: true, nameEs: true } }),
  ]);
  const inGame = gameSlots ? new Set(gameSlots.map((s) => s.speciesId)) : null;

  const caughtHere = new Set<number>();
  const ownedHere = new Set<number>();
  const gendersHere = new Map<number, { hasMale: boolean; hasFemale: boolean }>();
  const caughtIn = new Map<number, Set<string>>();
  for (const e of entries) {
    if (e.profileId === profileId) {
      caughtHere.add(e.speciesId);
      if (e.owned) ownedHere.add(e.speciesId);
      gendersHere.set(e.speciesId, { hasMale: e.hasMale, hasFemale: e.hasFemale });
      continue;
    }
    const name = getGame(e.profile.gameId)?.shortName ?? e.profile.gameId;
    if (!caughtIn.has(e.speciesId)) caughtIn.set(e.speciesId, new Set());
    caughtIn.get(e.speciesId)!.add(name);
  }

  const rosterOwned = new Set<number>();
  const rosterState = new Map<number, 'pending' | 'done'>();
  for (const p of roster) {
    if (p.owned) rosterOwned.add(p.speciesId);
    const complete = rosterProgress(p).complete;
    if (!complete || !rosterState.has(p.speciesId)) rosterState.set(p.speciesId, complete ? 'done' : 'pending');
  }

  // Evolution lines, to say which later stage the player holds instead of this one.
  const children = new Map<number, number[]>();
  const lineById = new Map(lines.map((l) => [l.id, l]));
  for (const l of lines) {
    if (l.evolvesFromId == null) continue;
    if (!children.has(l.evolvesFromId)) children.set(l.evolvesFromId, []);
    children.get(l.evolvesFromId)!.push(l.id);
  }
  const holding = (id: number) => ownedHere.has(id) || rosterOwned.has(id);
  const evolvedInto = (id: number) => {
    // Breadth first, so the nearest evolution wins.
    const queue = [...(children.get(id) ?? [])];
    for (let i = 0; i < queue.length; i++) {
      if (holding(queue[i])) return lineById.get(queue[i]) ?? null;
      queue.push(...(children.get(queue[i]) ?? []));
    }
    return null;
  };

  const versions = opts.gameId ? getGame(opts.gameId)?.versionExclusives : undefined;
  const exclusives = versions ? exclusiveBySpecies(versions) : null;

  // The Paldea Pokédex lists the Paldean form where there is one (Wooper, Tauros).
  const lookOf = (forms: (typeof slots)[number]['species']['forms']) =>
    (pokedexSlug === 'paldea' ? forms.find((f) => f.slug.includes('-paldea')) : undefined) ??
    forms.find((f) => f.isDefault);

  return slots.map((s) => {
    const look = lookOf(s.species.forms);
    const evo = evolvedInto(s.species.id);
    const side = exclusives?.get(s.species.id);
    return {
      speciesId: s.species.id,
      entryNumber: s.entryNumber,
      nameEn: s.species.nameEn,
      nameEs: s.species.nameEs,
      spriteUrl: look?.spriteUrl ?? null,
      types: look?.types ?? [],
      caught: caughtHere.has(s.species.id),
      inGame: inGame ? inGame.has(s.species.id) : true,
      hasMale: gendersHere.get(s.species.id)?.hasMale ?? false,
      hasFemale: gendersHere.get(s.species.id)?.hasFemale ?? false,
      genderRate: s.species.genderRate,
      caughtIn: [...(caughtIn.get(s.species.id) ?? [])],
      roster: rosterState.get(s.species.id) ?? 'none',
      exclusive: side && versions ? { versionName: side === 'own' ? versions.ownName : versions.otherName, own: side === 'own' } : null,
      owned: holding(s.species.id),
      ownedViaRoster: rosterOwned.has(s.species.id),
      evolvedInto: evo ? { nameEn: evo.nameEn, nameEs: evo.nameEs } : null,
    };
  });
}
