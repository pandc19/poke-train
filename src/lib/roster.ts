import { prisma } from './db';
import type { GameConfig } from './games';
import type { EvSpread } from './import/evs';
import { legalMoves } from './legality';
import type { TaskStatus } from './roster-status';

type Named = { id: number; nameEn: string; nameEs: string };

export type RosterMoveView = {
  slot: number;
  move: (Named & { type: string; damageClass: string }) | null;
  rawName: string | null;
  status: TaskStatus;
  legal: boolean | null;
};

/** Everything the roster UI needs for one Pokémon, already flattened for the client. */
export type RosterView = {
  id: string;
  species: Named;
  /** National Dex number. */
  nationalNumber: number;
  /** Entry number in the game's own Pokédex (first dex that lists it), or null if the game lacks it. */
  entryNumber: number | null;
  /** Sort key that follows the game's Pokédex order: base game first, then expansions. */
  dexOrder: number | null;
  baseSpecies: Named | null;
  formId: number | null;
  spriteUrl: string | null;
  types: string[];
  /** Abilities this species can actually have, for the editor and the legality flag. */
  abilityOptions: (Named & { isHidden: boolean })[];
  nickname: string | null;
  gender: 'MALE' | 'FEMALE' | 'BOTH' | 'GENDERLESS' | 'UNKNOWN';
  /** Eighths female; -1 = genderless. Decides which gender buttons make sense. */
  genderRate: number;
  origin: 'CAUGHT' | 'BRED' | 'UNKNOWN';
  owned: boolean;
  targetNature: Named | null;
  currentNature: Named | null;
  natureStatus: TaskStatus;
  ability: Named | null;
  abilityLegal: boolean | null;
  abilityStatus: TaskStatus;
  item: (Named & { spriteUrl: string | null }) | null;
  itemNote: string | null;
  itemStatus: TaskStatus;
  evs: EvSpread | null;
  evStatus: TaskStatus;
  teraType: string | null;
  /** The Judge's verdict, or null when not judged. */
  potential: 'DECENT' | 'ABOVE_AVERAGE' | 'RELATIVELY_SUPERIOR' | 'OUTSTANDING' | null;
  notes: string | null;
  moves: RosterMoveView[];
  audit: { provider: string; model: string; lang: string; createdAt: string; result: unknown } | null;
};

const named = { id: true, nameEn: true, nameEs: true } as const;

export async function loadRoster(profileId: string, ids?: string[]): Promise<RosterView[]> {
  const rows = await prisma.rosterPokemon.findMany({
    where: { profileId, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      species: {
        select: {
          ...named,
          genderRate: true,
          forms: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              isDefault: true,
              spriteUrl: true,
              types: true,
              abilities: { select: { isHidden: true, ability: { select: named } } },
            },
          },
        },
      },
      baseSpecies: { select: named },
      targetNature: { select: named },
      currentNature: { select: named },
      ability: { select: named },
      item: { select: { ...named, spriteUrl: true } },
      moves: {
        orderBy: { slot: 'asc' },
        include: { move: { select: { ...named, type: true, damageClass: true } } },
      },
      audits: { where: { kind: 'build' }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  // Where each species sits in this game's own Pokédex, for Pokédex-order sorting.
  const profile = await prisma.gameProfile.findUnique({ where: { id: profileId }, select: { gameId: true } });
  const slots = profile
    ? await prisma.pokedexSlot.findMany({
        where: { pokedex: { gameId: profile.gameId }, speciesId: { in: [...new Set(rows.map((r) => r.speciesId))] } },
        select: { speciesId: true, entryNumber: true, pokedex: { select: { sortOrder: true } } },
      })
    : [];
  const position = new Map<number, { dexOrder: number; entryNumber: number }>();
  for (const slot of slots) {
    const dexOrder = slot.pokedex.sortOrder * 10000 + slot.entryNumber;
    const known = position.get(slot.speciesId);
    if (!known || dexOrder < known.dexOrder) position.set(slot.speciesId, { dexOrder, entryNumber: slot.entryNumber });
  }

  return rows.map((r) => {
    const form = r.species.forms.find((f) => f.id === r.formId) ?? r.species.forms.find((f) => f.isDefault);
    const abilityOptions = (form?.abilities ?? []).map((a) => ({ ...a.ability, isHidden: a.isHidden }));
    const audit = r.audits[0];
    return {
      id: r.id,
      species: { id: r.species.id, nameEn: r.species.nameEn, nameEs: r.species.nameEs },
      nationalNumber: r.species.id,
      entryNumber: position.get(r.speciesId)?.entryNumber ?? null,
      dexOrder: position.get(r.speciesId)?.dexOrder ?? null,
      baseSpecies: r.baseSpecies,
      genderRate: r.species.genderRate,
      formId: form?.id ?? null,
      spriteUrl: form?.spriteUrl ?? null,
      types: form?.types ?? [],
      abilityOptions,
      nickname: r.nickname,
      gender: r.gender,
      origin: r.origin,
      owned: r.owned,
      targetNature: r.targetNature,
      currentNature: r.currentNature,
      natureStatus: r.natureStatus,
      ability: r.ability,
      abilityLegal: r.ability ? abilityOptions.some((a) => a.id === r.ability!.id) : null,
      abilityStatus: r.abilityStatus,
      item: r.item,
      itemNote: r.itemNote,
      itemStatus: r.itemStatus,
      evs: r.evs as EvSpread | null,
      evStatus: r.evStatus,
      teraType: r.teraType,
      potential: r.potential,
      notes: r.notes,
      moves: r.moves.map((m) => ({
        slot: m.slot,
        move: m.move,
        rawName: m.rawName,
        status: m.status,
        legal: m.legal,
      })),
      audit: audit
        ? {
            provider: audit.provider,
            model: audit.model,
            lang: audit.lang,
            createdAt: audit.createdAt.toISOString(),
            result: audit.result,
          }
        : null,
    };
  });
}

/** Re-runs the deterministic legality check for one Pokémon's moves and stores the result. */
export async function refreshLegality(rosterPokemonId: string, game: GameConfig): Promise<void> {
  const p = await prisma.rosterPokemon.findUnique({
    where: { id: rosterPokemonId },
    select: { speciesId: true, moves: { select: { id: true, moveId: true } } },
  });
  if (!p) return;
  const moveIds = p.moves.map((m) => m.moveId).filter((id): id is number => id != null);
  const legal = (await legalMoves([p.speciesId], moveIds, game.learnsetVersionGroups)).get(p.speciesId)!;
  await prisma.$transaction(
    p.moves.map((m) =>
      prisma.rosterMove.update({
        where: { id: m.id },
        data: { legal: m.moveId == null ? null : legal.has(m.moveId) },
      })
    )
  );
}

/** Name lists for the editors. Pokémon are limited to those obtainable in the game. */
export async function loadEditorOptions(game: GameConfig) {
  const [species, moves, items, natures] = await Promise.all([
    prisma.species.findMany({
      where: { pokedexSlots: { some: { pokedex: { gameId: game.id } } } },
      select: named,
      orderBy: { id: 'asc' },
    }),
    prisma.move.findMany({ select: named, orderBy: { nameEn: 'asc' } }),
    prisma.item.findMany({
      // Things a Pokémon can meaningfully hold; skips key items, TMs, balls, etc.
      where: {
        category: {
          in: [
            'held-items', 'choice', 'bad-held-items', 'type-enhancement', 'species-specific', 'plates',
            'in-a-pinch', 'picky-healing', 'type-protection', 'medicine', 'other', 'effort-training',
            'training', 'scarves', 'jewels', 'mega-stones', 'z-crystals', 'memories', 'held-items-other',
          ],
        },
      },
      select: named,
      orderBy: { nameEn: 'asc' },
    }),
    prisma.nature.findMany({ select: { ...named, increased: true, decreased: true }, orderBy: { nameEn: 'asc' } }),
  ]);
  return { species, moves, items, natures };
}

export type EditorOptions = Awaited<ReturnType<typeof loadEditorOptions>>;
