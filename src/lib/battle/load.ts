import { prisma } from '../db';
import type { GameConfig } from '../games';
import { TYPE_SLUGS } from '../pokemon-types';
import {
  chartFrom,
  rankCounters,
  weaknessTable,
  type BaseStats,
  type Candidate,
  type CandidateMove,
  type Counter,
  type OpponentInput,
  type TypeChart,
} from './counters';

export type Named = { id: number; nameEn: string; nameEs: string };

export type MoveView = Named & { type: string; power: number | null; damageClass: string };

export type CounterView = {
  species: Named;
  formId: number;
  spriteUrl: string | null;
  types: string[];
  /** Where it comes from: a roster entry, or a species of the game. */
  source: 'roster' | 'game';
  /** You have one (roster entry in your box, or an owned Pokédex entry). */
  have: boolean;
  nickname: string | null;
  move: MoveView & { multiplier: number; stab: boolean; known: boolean };
  alternatives: (MoveView & { multiplier: number; stab: boolean; known: boolean })[];
  /** Worst hit it takes from the opponent's same-type attacks. */
  incoming: number;
};

export type BattleOpponentView = {
  id: string;
  label: string | null;
  archived: boolean;
  kind: 'RAID' | 'STANDARD';
  stars: number | null;
  teraType: string | null;
  notes: string | null;
  species: Named;
  formId: number;
  formSlug: string;
  isDefaultForm: boolean;
  spriteUrl: string | null;
  /** Its own types, whatever its Tera type is. */
  types: string[];
  ability: Named | null;
  /** Types that do something other than normal damage to it, most damaging first. */
  weaknesses: { type: string; multiplier: number }[];
  /** The strongest moves of each type it is weak to that Pokémon of this game can learn. */
  strongMoves: { type: string; multiplier: number; moves: MoveView[] }[];
  roster: CounterView[];
  suggestions: CounterView[];
};

type IndexedForm = Candidate & {
  nameEn: string;
  nameEs: string;
  spriteUrl: string | null;
};

type GameIndex = {
  /** Fully evolved, non-legendary forms of the game, with every damaging move they can learn. */
  forms: IndexedForm[];
  moves: Map<number, MoveView & { accuracy: number | null }>;
};

/** Moves that cost the user too much (faint, half its HP...) to be recommended as a plain attack. */
const COSTLY_MOVES = new Set([
  'explosion',
  'self-destruct',
  'misty-explosion',
  'final-gambit',
  'steel-beam',
  'mind-blown',
  'chloroform',
  'belly-drum',
  'dream-eater',
  'focus-punch',
  'last-resort',
  'fake-out',
  'first-impression',
  'upper-hand',
]);

const globalForBattle = globalThis as unknown as { battleIndex?: Map<string, Promise<GameIndex>> };
const indexes = (globalForBattle.battleIndex ??= new Map());

/** Game data does not change while the app runs (only the sync script writes it), so it is kept. */
function gameIndex(game: GameConfig): Promise<GameIndex> {
  let p = indexes.get(game.id);
  if (!p) {
    p = buildIndex(game);
    indexes.set(game.id, p);
    p.catch(() => indexes.delete(game.id));
  }
  return p;
}

async function loadMoves(): Promise<GameIndex['moves']> {
  const rows = await prisma.move.findMany({
    where: { damageClass: { not: 'status' }, power: { gt: 0 } },
    select: { id: true, slug: true, nameEn: true, nameEs: true, type: true, power: true, damageClass: true, accuracy: true },
  });
  return new Map(rows.filter((m) => !COSTLY_MOVES.has(m.slug)).map((m) => [m.id, m]));
}

async function learnable(game: GameConfig, formIds: number[]) {
  const rows = await prisma.$queryRaw<{ form_id: number; move_id: number }[]>`
    SELECT DISTINCT form_id, move_id FROM learnsets
    WHERE version_group = ANY(${game.learnsetVersionGroups}) AND form_id = ANY(${formIds})`;
  const byForm = new Map<number, number[]>();
  for (const r of rows) {
    const list = byForm.get(r.form_id) ?? [];
    list.push(r.move_id);
    byForm.set(r.form_id, list);
  }
  return byForm;
}

function toMoves(ids: number[], moves: GameIndex['moves'], known: Set<number>): CandidateMove[] {
  const out: CandidateMove[] = [];
  for (const id of new Set([...ids, ...known])) {
    const m = moves.get(id);
    if (!m || m.power == null) continue;
    out.push({
      id,
      type: m.type,
      damageClass: m.damageClass === 'physical' ? 'physical' : 'special',
      power: m.power,
      accuracy: m.accuracy,
      known: known.has(id),
    });
  }
  return out;
}

async function buildIndex(game: GameConfig): Promise<GameIndex> {
  const moves = await loadMoves();
  const forms = await prisma.form.findMany({
    where: {
      species: {
        isBaby: false,
        isSpecial: false,
        evolvesTo: { none: {} },
        pokedexSlots: { some: { pokedex: { gameId: game.id } } },
      },
      learnsets: { some: { versionGroup: { in: game.learnsetVersionGroups } } },
    },
    select: {
      id: true,
      speciesId: true,
      types: true,
      baseStats: true,
      spriteUrl: true,
      species: { select: { nameEn: true, nameEs: true } },
    },
  });
  const byForm = await learnable(game, forms.map((f) => f.id));
  return {
    moves,
    forms: forms.map((f) => ({
      formId: f.id,
      speciesId: f.speciesId,
      types: f.types,
      stats: f.baseStats as BaseStats,
      spriteUrl: f.spriteUrl,
      nameEn: f.species.nameEn,
      nameEs: f.species.nameEs,
      moves: toMoves(byForm.get(f.id) ?? [], moves, new Set()),
    })),
  };
}

let chartCache: Promise<{ chart: TypeChart; types: string[] }> | null = null;
function loadChart() {
  chartCache ??= prisma.typeEffect
    .findMany()
    .then((rows) => ({ chart: chartFrom(rows), types: TYPE_SLUGS.filter((t) => t !== 'stellar') }))
    .catch((e) => {
      chartCache = null;
      throw e;
    });
  return chartCache;
}

/**
 * Loads saved opponents with what to use against each, worked out from the current roster, so a
 * Pokémon added to the roster shows up as a counter without re-saving anything.
 */
export async function loadOpponents(game: GameConfig, profileId: string, ids?: string[]): Promise<BattleOpponentView[]> {
  const rows = await prisma.battleOpponent.findMany({
    where: { profileId, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  if (!rows.length) return [];

  const [{ chart, types: allTypes }, index, roster, dex] = await Promise.all([
    loadChart(),
    gameIndex(game),
    prisma.rosterPokemon.findMany({
      // Only what you actually have: planned Pokémon are not in your box yet, and breeders are
      // there to breed, not to battle.
      where: { profileId, owned: true, roles: { some: { role: 'ROSTER' } } },
      select: {
        id: true,
        speciesId: true,
        formId: true,
        nickname: true,
        owned: true,
        abilityId: true,
        species: { select: { nameEn: true, nameEs: true } },
        moves: { where: { moveId: { not: null } }, select: { moveId: true } },
      },
    }),
    prisma.pokedexEntry.findMany({ where: { profileId, owned: true }, select: { speciesId: true } }),
  ]);
  const ownedSpecies = new Set(dex.map((d) => d.speciesId));

  // Forms of the opponents and of the roster; the roster's default form when none is set.
  const speciesIds = [...new Set([...rows.map((r) => r.speciesId), ...roster.map((r) => r.speciesId)])];
  const forms = await prisma.form.findMany({
    where: {
      OR: [
        { id: { in: [...rows.flatMap((r) => (r.formId ? [r.formId] : [])), ...roster.flatMap((r) => (r.formId ? [r.formId] : []))] } },
        { speciesId: { in: speciesIds }, isDefault: true },
      ],
    },
    select: {
      id: true,
      speciesId: true,
      slug: true,
      isDefault: true,
      types: true,
      baseStats: true,
      spriteUrl: true,
      abilities: { select: { abilityId: true } },
      species: { select: { id: true, nameEn: true, nameEs: true } },
    },
  });
  const formById = new Map(forms.map((f) => [f.id, f]));
  const defaultForm = new Map(forms.filter((f) => f.isDefault).map((f) => [f.speciesId, f]));
  const formOf = (speciesId: number, formId: number | null) =>
    (formId != null ? formById.get(formId) : undefined) ?? defaultForm.get(speciesId);

  const abilityIds = [
    ...new Set([...rows, ...roster].flatMap((r) => (r.abilityId ? [r.abilityId] : []))),
  ];
  const abilities = await prisma.ability.findMany({
    where: { id: { in: abilityIds } },
    select: { id: true, slug: true, nameEn: true, nameEs: true },
  });
  const abilityById = new Map(abilities.map((a) => [a.id, a]));

  // Roster candidates: only the moves each knows now (the player will not retrain them), with its ability.
  const rosterForms = roster.flatMap((r) => {
    const f = formOf(r.speciesId, r.formId);
    return f ? [{ r, f }] : [];
  });
  const rosterCandidates = rosterForms.map(({ r, f }, ref) => ({
    r,
    f,
    candidate: {
      ref,
      formId: f.id,
      speciesId: f.speciesId,
      types: f.types,
      stats: f.baseStats as BaseStats,
      ability: r.abilityId ? (abilityById.get(r.abilityId)?.slug ?? null) : null,
      moves: toMoves(
        [],
        index.moves,
        new Set(r.moves.flatMap((m) => (m.moveId != null ? [m.moveId] : [])))
      ),
    } satisfies Candidate,
  }));

  const moveView = (id: number): MoveView => {
    const m = index.moves.get(id);
    return m
      ? { id, nameEn: m.nameEn, nameEs: m.nameEs, type: m.type, power: m.power, damageClass: m.damageClass }
      : { id, nameEn: `#${id}`, nameEs: `#${id}`, type: 'normal', power: null, damageClass: 'physical' };
  };
  // Moves a roster Pokémon knows might be outside the global move table when costly; keep it simple.
  const withMove = (c: Counter) => ({
    ...moveView(c.move.id),
    multiplier: c.move.multiplier,
    stab: c.move.stab,
    known: c.move.known,
  });

  return rows.map((o) => {
    const form = formOf(o.speciesId, o.formId);
    if (!form) throw new Error(`No form for species ${o.speciesId}`);
    const ability = o.abilityId ? (abilityById.get(o.abilityId) ?? null) : null;
    const input: OpponentInput = {
      types: form.types,
      teraType: o.teraType,
      stats: form.baseStats as BaseStats,
      ability: ability?.slug ?? null,
    };
    const table = weaknessTable(chart, input, allTypes);
    const weaknesses = Object.entries(table)
      .filter(([, m]) => m !== 1)
      .map(([type, multiplier]) => ({ type, multiplier }))
      .sort((a, b) => b.multiplier - a.multiplier);

    const strongMoves = weaknesses
      .filter((w) => w.multiplier > 1)
      .map((w) => ({
        type: w.type,
        multiplier: w.multiplier,
        moves: [...index.moves.values()]
          .filter((m) => m.type === w.type && (m.accuracy ?? 100) >= 80)
          .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))
          .slice(0, 4)
          .map((m) => moveView(m.id)),
      }));

    const rankedRoster = rankCounters(
      chart,
      input,
      table,
      rosterCandidates.map((x) => x.candidate),
      8
    );
    const rosterViews: CounterView[] = rankedRoster.map((c) => {
      const entry = rosterCandidates[c.ref!];
      return {
        species: { id: entry.f.speciesId, nameEn: entry.f.species.nameEn, nameEs: entry.f.species.nameEs },
        formId: c.formId,
        spriteUrl: entry.f.spriteUrl,
        types: entry.f.types,
        source: 'roster',
        have: entry.r.owned,
        nickname: entry.r.nickname,
        move: withMove(c),
        alternatives: c.alternatives.map((a) => ({ ...moveView(a.id), ...a, id: a.id })),
        incoming: c.incoming,
      };
    });

    const inRoster = new Set(rosterViews.map((r) => r.species.id));
    const formByIndexId = new Map(index.forms.map((f) => [f.formId, f]));
    // Suggestions are spread over move types (at most three of each) so they are not all one kind.
    const perType = new Map<string, number>();
    const rankedGame = rankCounters(chart, input, table, index.forms, 80)
      .filter((c) => !inRoster.has(c.speciesId))
      .filter((c) => {
        const type = index.moves.get(c.move.id)?.type ?? '';
        const n = perType.get(type) ?? 0;
        perType.set(type, n + 1);
        return n < 3;
      })
      .slice(0, 8);
    const suggestions: CounterView[] = rankedGame.map((c) => {
      const f = formByIndexId.get(c.formId)!;
      return {
        species: { id: f.speciesId, nameEn: f.nameEn, nameEs: f.nameEs },
        formId: c.formId,
        spriteUrl: f.spriteUrl,
        types: f.types,
        source: 'game',
        have: ownedSpecies.has(f.speciesId),
        nickname: null,
        move: withMove(c),
        alternatives: c.alternatives.map((a) => ({ ...moveView(a.id), ...a, id: a.id })),
        incoming: c.incoming,
      };
    });

    return {
      id: o.id,
      label: o.label,
      archived: o.archivedAt != null,
      kind: o.kind,
      stars: o.stars,
      teraType: o.teraType,
      notes: o.notes,
      species: { id: form.species.id, nameEn: form.species.nameEn, nameEs: form.species.nameEs },
      formId: form.id,
      formSlug: form.slug,
      isDefaultForm: form.isDefault,
      spriteUrl: form.spriteUrl,
      types: form.types,
      ability: ability ? { id: ability.id, nameEn: ability.nameEn, nameEs: ability.nameEs } : null,
      weaknesses,
      strongMoves,
      roster: rosterViews,
      suggestions,
    };
  });
}
