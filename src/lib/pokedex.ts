import { prisma } from './db';
import { LOCAL_USER_ID } from './constants';
import { NATIONAL_DEX_SLUG, getGame } from './games';
import { exclusiveBySpecies } from './games/exclusives';
import { type Variant, REGIONS, encodeKey, variantOfSlug } from './dex-variant';

export type DexCell = {
  speciesId: number;
  /** Identifies this card's own caught state: the species plus the regional form it shows. */
  key: number;
  entryNumber: number;
  nameEn: string;
  nameEs: string;
  spriteUrl: string | null;
  /** Set when the card shows a regional form (Alolan Dugtrio), tracked apart from the normal one. */
  formLabel: string | null;
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
  /** A roster Pokémon of this species is marked as a keeper. */
  keeper: boolean;
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
  const lastEntry = opts.gameId
    ? getGame(opts.gameId)?.pokedexes.find((d) => d.slug === pokedexSlug)?.lastEntry
    : undefined;
  const [slots, entries, roster, gameSlots, lines] = await Promise.all([
    prisma.pokedexSlot.findMany({
      where: { pokedex: { slug: pokedexSlug }, ...(lastEntry ? { entryNumber: { lte: lastEntry } } : {}) },
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
              where: {
                OR: [
                  { isDefault: true },
                  { slug: { contains: '-paldea' } },
                  ...REGIONS.map((r) => ({ slug: { contains: `-${r}` } })),
                ],
              },
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
        variant: true,
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
  const regionalSpecies = new Set(
    (opts.gameId && getGame(opts.gameId)?.pokedexes.find((d) => d.slug === pokedexSlug)?.regionalSpecies) || []
  );

  // Which form a card shows, and so which caught state it owns: a Pokédex that lists regional
  // forms shows those, the Paldea one shows the Paldean form, any other the species' own form.
  type Form = (typeof slots)[number]['species']['forms'][number];
  const lookOf = (speciesId: number, forms: Form[]): { look: Form | undefined; variant: Variant } => {
    const own = forms.find((f) => f.isDefault);
    if (regionalSpecies.has(speciesId)) {
      for (const region of REGIONS) {
        const form = forms.find((f) => !f.isDefault && variantOfSlug(f.slug) === region);
        if (form) return { look: form, variant: region };
      }
    }
    const paldean = pokedexSlug === 'paldea' ? forms.find((f) => f.slug.includes('-paldea')) : undefined;
    return { look: paldean ?? own, variant: '' };
  };

  // Roster Pokémon count for the form they are.
  const rosterFormIds = [...new Set(roster.map((p) => p.formId).filter((id): id is number => id != null))];
  const rosterForms = rosterFormIds.length
    ? await prisma.form.findMany({ where: { id: { in: rosterFormIds } }, select: { id: true, slug: true } })
    : [];
  const rosterVariant = new Map(rosterForms.map((f) => [f.id, variantOfSlug(f.slug)]));
  const rosterKey = (p: (typeof roster)[number]) =>
    encodeKey(p.speciesId, p.formId != null ? (rosterVariant.get(p.formId) ?? '') : '');

  const caughtHere = new Set<number>();
  const ownedHere = new Set<number>();
  const gendersHere = new Map<number, { hasMale: boolean; hasFemale: boolean }>();
  const caughtIn = new Map<number, Set<string>>();
  for (const e of entries) {
    if (e.profileId === profileId) {
      const key = encodeKey(e.speciesId, e.variant as Variant);
      caughtHere.add(key);
      if (e.owned) ownedHere.add(key);
      gendersHere.set(key, { hasMale: e.hasMale, hasFemale: e.hasFemale });
      continue;
    }
    const name = getGame(e.profile.gameId)?.shortName ?? e.profile.gameId;
    if (!caughtIn.has(e.speciesId)) caughtIn.set(e.speciesId, new Set());
    caughtIn.get(e.speciesId)!.add(name);
  }

  const rosterOwned = new Set<number>();
  const rosterKeeper = new Set<number>();
  for (const p of roster) {
    const key = rosterKey(p);
    if (p.owned) rosterOwned.add(key);
    if (p.keeper) rosterKeeper.add(key);
  }

  // Evolution lines, to say which later stage the player holds instead of this one.
  const children = new Map<number, number[]>();
  const lineById = new Map(lines.map((l) => [l.id, l]));
  for (const l of lines) {
    if (l.evolvesFromId == null) continue;
    if (!children.has(l.evolvesFromId)) children.set(l.evolvesFromId, []);
    children.get(l.evolvesFromId)!.push(l.id);
  }
  const holding = (id: number, variant: Variant) => {
    const key = encodeKey(id, variant);
    return ownedHere.has(key) || rosterOwned.has(key);
  };
  const evolvedInto = (id: number, variant: Variant) => {
    // Breadth first, so the nearest evolution wins.
    const queue = [...(children.get(id) ?? [])];
    for (let i = 0; i < queue.length; i++) {
      if (holding(queue[i], variant)) return lineById.get(queue[i]) ?? null;
      queue.push(...(children.get(queue[i]) ?? []));
    }
    return null;
  };

  const versions = opts.gameId ? getGame(opts.gameId)?.versionExclusives : undefined;
  const exclusives = versions ? exclusiveBySpecies(versions) : null;

  return slots.map((s) => {
    const { look, variant } = lookOf(s.species.id, s.species.forms);
    const key = encodeKey(s.species.id, variant);
    const evo = evolvedInto(s.species.id, variant);
    const side = exclusives?.get(s.species.id);
    return {
      speciesId: s.species.id,
      key,
      entryNumber: s.entryNumber,
      nameEn: s.species.nameEn,
      nameEs: s.species.nameEs,
      spriteUrl: look?.spriteUrl ?? null,
      formLabel: variant ? variant[0].toUpperCase() + variant.slice(1) : null,
      types: look?.types ?? [],
      caught: caughtHere.has(key),
      inGame: inGame ? inGame.has(s.species.id) : true,
      hasMale: gendersHere.get(key)?.hasMale ?? false,
      hasFemale: gendersHere.get(key)?.hasFemale ?? false,
      genderRate: s.species.genderRate,
      caughtIn: [...(caughtIn.get(s.species.id) ?? [])],
      keeper: rosterKeeper.has(key),
      exclusive: side && versions ? { versionName: side === 'own' ? versions.ownName : versions.otherName, own: side === 'own' } : null,
      owned: holding(s.species.id, variant),
      ownedViaRoster: rosterOwned.has(key),
      evolvedInto: evo ? { nameEn: evo.nameEn, nameEs: evo.nameEs } : null,
    };
  });
}
