import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { prisma } from '../db';
import type { GameConfig } from '../games';
import { learnableMoves } from '../breeding/moves';
import { evGap, evTotal, formatEvs } from '../import/evs';
import { loadEvSources } from '../ev-catalog';
import { describePlan, legalPlan, trainingItemsFor } from '../ev-plan';
import type { Lang } from '../i18n';
import { ivRating } from '../iv-ratings';
import { potentialLevel } from '../potential';
import type { RosterView } from '../roster';
import { type BuildAudit, type BuildAuditRaw, BuildAuditNoEvSchema, BuildAuditRawSchema, LocationSchema, StarterAdviceSchema, TeamAuditSchema } from './schema';
import type { AiProvider, ModelTier } from './types';

const PROMPT_VERSION = 12;

const system = (game: GameConfig, lang: Lang) =>
  [
    `You are a competitive Pokémon coach helping one player with ${game.name}.`,
    `Only recommend Pokémon, moves, items and mechanics that exist in ${game.name}, including its DLC.`,
    'Be specific and practical. If you are not sure where something is found, say so rather than guessing.',
    'Prefer advice the player can act on without starting over: say what is easy, and never suggest a move the Pokémon cannot learn in this game.',
    lang === 'es'
      ? 'Write every text field in Spanish, but always write the names of Pokémon, moves, items (TMs, vitamins, berries), abilities, natures and types in English exactly as the English game shows them (for example Stone Edge, Choice Band, Protein, Adamant, Intimidate), never translated.'
      : 'Write every text field in English.',
  ].join(' ');

/**
 * Runs an AI task through the AiAudit cache: the same question (same kind,
 * provider and input) is answered from the database and never paid for twice.
 */
async function cached<Raw, T = Raw>(
  provider: AiProvider,
  key: { kind: string; profileId: string; rosterPokemonId?: string; refresh?: boolean; lang: Lang },
  input: unknown,
  request: {
    system: string;
    prompt: string;
    schema: z.ZodType<Raw>;
    schemaName: string;
    webSearch: boolean;
    tier: ModelTier;
    /** Turns the model's answer into what is stored and shown, before it is saved. */
    finish?: (raw: Raw) => T | Promise<T>;
  }
): Promise<T> {
  const model = provider.modelFor(request.tier);
  const inputHash = createHash('sha256')
    .update(JSON.stringify({ v: PROMPT_VERSION, model, input }))
    .digest('hex');
  const where = { kind_provider_inputHash: { kind: key.kind, provider: provider.name, inputHash } };

  if (!key.refresh) {
    const hit = await prisma.aiAudit.findUnique({ where });
    if (hit) {
      // Reusing a saved answer makes it the one the card shows, with no new request.
      await prisma.aiAudit.update({ where: { id: hit.id }, data: { createdAt: new Date() } });
      return hit.result as T;
    }
  }
  const { finish, ...ask } = request;
  const raw = await provider.generate(ask);
  const result = finish ? await finish(raw) : (raw as unknown as T);
  const data = {
    profileId: key.profileId,
    rosterPokemonId: key.rosterPokemonId,
    model,
    lang: key.lang,
    result: result as object,
    createdAt: new Date(),
  };
  await prisma.aiAudit.upsert({
    where,
    update: data,
    create: { ...data, kind: key.kind, provider: provider.name, inputHash },
  });
  return result;
}

/** The Judge's word for each stat's IV, with the IV it stands for. Only the stats that were judged. */
function describeIvRatings(p: RosterView): Record<string, string> | null {
  const names = { hp: 'HP', attack: 'Attack', defense: 'Defense', specialAttack: 'Sp. Atk', specialDefense: 'Sp. Def', speed: 'Speed' } as const;
  const out: Record<string, string> = {};
  for (const [key, label] of Object.entries(names)) {
    const r = ivRating(p.ivRatings?.[key as keyof typeof names]);
    if (r) out[label] = `${r.label} (IV ${r.low === r.high ? r.low : `${r.low}-${r.high}`})`;
  }
  return Object.keys(out).length ? out : null;
}

const STAT_NAMES = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  specialAttack: 'Sp. Atk',
  specialDefense: 'Sp. Def',
  speed: 'Speed',
} as const;

/** All six values with their stat names, so a stat can never be read as an EV or the other way round. */
const statLine = (v: Record<keyof typeof STAT_NAMES, number>) =>
  Object.fromEntries(Object.entries(STAT_NAMES).map(([k, name]) => [name, v[k as keyof typeof STAT_NAMES]]));

/** A compact, language-neutral description of a Pokémon as it is now, used both as prompt and cache key. */
function describeBuild(p: RosterView, hasEvs = true) {
  const gap = hasEvs && p.evs && p.currentEvs ? evGap(p.evs, p.currentEvs) : null;
  return {
    pokemon: p.species.nameEn,
    types: p.types,
    baseStats: p.baseStats,
    level: p.level,
    // The stats it actually has right now, as the game shows them. These are NOT EVs.
    currentStats: p.currentStats ? statLine(p.currentStats) : null,
    // The nature it has now, when known, and the one the player is aiming for.
    currentNature: p.currentNature?.nameEn ?? null,
    targetNature: p.targetNature?.nameEn ?? null,
    ability: p.ability?.nameEn ?? null,
    heldItem: p.item?.nameEn ?? p.itemNote,
    ...(hasEvs
      ? {
          // EVs per stat, all six listed. Not the same thing as the stats above.
          currentEvs: p.currentEvs ? statLine(p.currentEvs) : null,
          evsLeftToTrain: p.currentEvs ? Math.max(0, 510 - evTotal(p.currentEvs)) : null,
          // Worked out from the stats and IV ratings, so they may be a little low.
          currentEvsAreEstimated: p.currentEvs ? p.currentEvsEstimated : null,
          // The spread the player is training towards, when there is one. The plan is then fixed.
          ...(p.evs
            ? {
                targetEvs: statLine(p.evs),
                evsStillMissing: gap && evTotal(gap) > 0 ? formatEvs(gap) : null,
              }
            : {}),
        }
      : {}),
    teraType: p.teraType,
    // What the in-game Judge said about its IVs, when the player has had it judged.
    judgePotential: potentialLevel(p.potential)?.label ?? null,
    ivRatings: describeIvRatings(p),
    moves: p.moves.map((m) => ({ name: m.move?.nameEn ?? m.rawName, known: m.status === 'DONE' })),
  };
}

export async function auditBuild(
  provider: AiProvider,
  game: GameConfig,
  lang: Lang,
  profileId: string,
  p: RosterView,
  refresh: boolean,
  deep = false
) {
  const hasEvs = game.features.evs;
  // Where EVs are easy to reset, a target spread makes sense; elsewhere work from what it has.
  const hasTarget = hasEvs && game.features.evTarget;
  const build = describeBuild(p, hasEvs);
  const illegal = p.moves.filter((m) => m.legal === false).map((m) => m.move!.nameEn);

  // Everything it can legally have in this game, so suggestions come from real options.
  const pool = await learnableMoves(game, p.species.id);
  // Each move with its type, category and power, so advice about which stat it uses comes from data.
  const describeMove = (m: { nameEn: string; type: string; damageClass: string; power: number | null }) =>
    `${m.nameEn} (${m.type}, ${m.damageClass}${m.power ? `, power ${m.power}` : ''})`;
  const legalMovePool = {
    eggMoves: pool.egg.map(describeMove),
    learnedNormally: pool.other.map(describeMove),
  };
  const details = new Map([...pool.egg, ...pool.other].map((m) => [m.nameEn, describeMove(m)]));
  build.moves = build.moves.map((m) => ({ ...m, name: details.get(m.name ?? '') ?? m.name }));

  return cached(
    provider,
    { kind: 'build', profileId, rosterPokemonId: p.id, refresh, lang },
    { build, illegal, legalMovePool, lang },
    {
      system: system(game, lang),
      schema: hasEvs ? BuildAuditRawSchema : BuildAuditNoEvSchema,
      finish: async (raw) => {
        if (!hasEvs) return raw as BuildAudit;
        // The spread is the model's proposal; what it means for this Pokémon is worked out here.
        const withPlan = raw as BuildAuditRaw;
        // A plan the player has fixed is kept as it is; otherwise it is the model's proposal made legal.
        const plan = p.evs ?? legalPlan(withPlan.evPlan.spread, p.currentEvs, !hasTarget);
        const { spread, toTrain } = describePlan(plan, p.currentEvs, lang === 'es' ? 'nada' : 'nothing');
        const gap = evGap(plan, p.currentEvs);
        const missing = (Object.keys(gap) as (keyof typeof gap)[]).filter((k) => gap[k] > 0);
        return {
          heldItem: withPlan.heldItem,
          recommendedMoves: withPlan.recommendedMoves,
          evPlan: {
            spread,
            toTrain,
            // Who to battle comes from the games' own data, not from the model.
            sources: (await loadEvSources(game.id, missing)).map((x) => ({ ...x, stat: STAT_NAMES[x.stat] })),
            items: trainingItemsFor(gap, lang === 'es'),
          },
        };
      },
      schemaName: 'build_audit',
      // Item and EV advice depends on how this game works, so let it look things up.
      webSearch: true,
      // One Pokémon at a time is the everyday request; "deeper" is the user's choice.
      tier: deep ? 'deep' : 'bulk',
      prompt: [
        'Give exactly what the player needs for this Pokémon as it is right now, and nothing else. ' +
          'Work with what it already has: its nature, ability, potential, current EVs, held item and known moves are the starting point. Do not propose rebuilding it.',
        JSON.stringify({ pokemon: build, legalMovePool }, null, 2),
        hasEvs
          ? 'evPlan: currentStats are the numbers the game shows (HP 331, Attack 328…). They are NOT EVs, so never use them for the plan. ' +
            'currentEvs are the EVs it has trained, per stat, and evsLeftToTrain is how many of the 510 are still free. ' +
            'spread is the EVs it should finish with, as numbers per stat (at most 252 each and 510 in total). ' +
            (p.evs
              ? 'The player has fixed the EV plan: targetEvs is the spread it finishes with, so use it exactly as spread. ' +
                'Choose the held item and the moves for those EVs. '
              : '') +
            (hasTarget
              ? 'EVs are easy to retrain in this game, so choose the best spread for its role, nature, base stats and moves; currentEvs only says where it starts. '
              : 'Its EVs are hard to change in this game, so every stat must stay at or above its currentEvs: only add to them with the evsLeftToTrain still free, and never start over. ') +
            'The EVs you add in total must not go over evsLeftToTrain, and it is fine to leave some unspent: ' +
            'put them only into the stats its role really needs (a physical attacker needs no Sp. Atk, and a slow bulky Pokémon rarely needs Speed). ' +
            'Do not say which Pokémon to battle, or give vitamin counts or EV arithmetic: the app works those out.' +
            (game.evNote ? ` About EV training in this game: ${game.evNote}` : '')
          : `${game.name} has no EV training, so there is no EV plan.`,
        'heldItem: the best held item for it as it is now. If the one it holds is already the best, name it and say to keep it.',
        `recommendedMoves: the best four moves for it given its nature${hasEvs ? ' and the EVs it will finish with' : ''}, chosen ONLY from legalMovePool. ` +
          'Prefer moves it already knows over ones it would have to get. ' +
          'Do not recommend moves that use a stat it is not investing in: no special attacks when its Sp. Atk gets no EVs and its nature does not raise it, ' +
          'and no physical attacks when its Attack gets none. Status and setup moves are fine. ' +
          'Use the type, category and power given; do not invent move effects. Keep each reason to one short sentence.',
        illegal.length
          ? `Game data says this Pokémon cannot learn: ${illegal.join(', ')}. Replace each with a move from legalMovePool.`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    }
  );
}

export function auditTeam(provider: AiProvider, game: GameConfig, lang: Lang, profileId: string, roster: RosterView[]) {
  const team = roster.map((p) => describeBuild(p, game.features.evs));
  return cached(provider, { kind: 'team', profileId, lang }, { team, lang }, {
    system: system(game, lang),
    schema: TeamAuditSchema,
    schemaName: 'team_audit',
    webSearch: false,
    tier: 'deep',
    prompt:
      'This is the player\'s whole trained roster. Audit it as a pool to build teams from: shared weaknesses, ' +
      'missing roles (speed control, hazards, pivots, walls), redundant picks, and the most valuable additions.\n\n' +
      JSON.stringify(team, null, 2),
  });
}

/** Where to catch a Pokémon. PokéAPI has no encounter data for recent games, so this is researched. */
export function researchLocation(provider: AiProvider, game: GameConfig, lang: Lang, profileId: string, pokemon: string) {
  return cached(provider, { kind: 'location', profileId, lang }, { game: game.id, pokemon, lang }, {
    system: system(game, lang),
    schema: LocationSchema,
    schemaName: 'location',
    webSearch: true,
    tier: 'bulk',
    prompt:
      `Where can ${pokemon} be caught in ${game.name}? Be brief: at most two places, best first, ` +
      'each one the area name and at most one short sentence of detail (DLC area or raid only, if that applies). ' +
      'Do not explain what you could not confirm: leave it out. ' +
      'If it cannot be caught in the wild, set found to false and say in one sentence how it is obtained. ' +
      'notes stays empty unless one short sentence is essential (for example, it needs the DLC).',
  });
}

export function adviseStarterTeam(
  provider: AiProvider,
  game: GameConfig,
  lang: Lang,
  profileId: string,
  owned: string[],
  refresh: boolean
) {
  return cached(provider, { kind: 'starter-team', profileId, refresh, lang }, { game: game.id, owned, lang }, {
    system: system(game, lang),
    schema: StarterAdviceSchema,
    schemaName: 'starter_advice',
    webSearch: true,
    tier: 'deep',
    prompt:
      `Recommend an early-game utility core for ${game.name}: story progression, EV training, catching ` +
      '(False Swipe plus a sleep or paralysis move) and egg hatching (Flame Body or similar). ' +
      `The player already has: ${owned.length ? owned.join(', ') : 'nothing yet'}. Prefer what they own, ` +
      'and for anything else say where to get it early. Six picks at most.',
  });
}
