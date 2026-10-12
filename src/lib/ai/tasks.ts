import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { prisma } from '../db';
import type { GameConfig } from '../games';
import { learnableMoves } from '../breeding/moves';
import { evGap, evTotal, formatEvs } from '../import/evs';
import type { Lang } from '../i18n';
import { ivAssumption, potentialLevel } from '../potential';
import type { RosterView } from '../roster';
import { BuildAuditNoEvSchema, BuildAuditSchema, LocationSchema, StarterAdviceSchema, TeamAuditSchema } from './schema';
import type { AiProvider, ModelTier } from './types';

const PROMPT_VERSION = 3;

const system = (game: GameConfig, lang: Lang) =>
  [
    `You are a competitive Pokémon coach helping one player with ${game.name}.`,
    `Only recommend Pokémon, moves, items and mechanics that exist in ${game.name}, including its DLC.`,
    'Be specific and practical. If you are not sure where something is found, say so rather than guessing.',
    'Prefer advice the player can act on without starting over: say what is easy, and never suggest a move the Pokémon cannot learn in this game.',
    `Write every text field in ${lang === 'es' ? 'Spanish, using the official Spanish names' : 'English'}.`,
  ].join(' ');

/**
 * Runs an AI task through the AiAudit cache: the same question (same kind,
 * provider and input) is answered from the database and never paid for twice.
 */
async function cached<T>(
  provider: AiProvider,
  key: { kind: string; profileId: string; rosterPokemonId?: string; refresh?: boolean; lang: Lang },
  input: unknown,
  request: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    schemaName: string;
    webSearch: boolean;
    tier: ModelTier;
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
  const result = await provider.generate(request);
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

/** A compact, language-neutral description of a Pokémon as it is now, used both as prompt and cache key. */
function describeBuild(p: RosterView, hasEvs = true, hasTarget = true) {
  const gap = hasEvs && hasTarget && p.evs && p.currentEvs ? evGap(p.evs, p.currentEvs) : null;
  return {
    pokemon: p.species.nameEn,
    types: p.types,
    baseStats: p.baseStats,
    level: p.level,
    // The stats it actually has right now, as the game shows them.
    currentStats: p.currentStats ? formatEvs(p.currentStats) : null,
    // The nature it has now, when known, and the one the player is aiming for.
    currentNature: p.currentNature?.nameEn ?? null,
    targetNature: p.targetNature?.nameEn ?? null,
    ability: p.ability?.nameEn ?? null,
    heldItem: p.item?.nameEn ?? p.itemNote,
    ...(hasEvs
      ? {
          currentEvs: p.currentEvs ? formatEvs(p.currentEvs) : null,
          // Worked out from the stats assuming perfect IVs, so they may be a little low.
          currentEvsAreEstimated: p.currentEvs ? p.currentEvsEstimated : null,
          assumedIvPerStat: p.currentEvs && p.currentEvsEstimated ? ivAssumption(p.potential).assumed : null,
          ...(hasTarget
            ? {
                targetEvs: p.evs ? formatEvs(p.evs) : null,
                evsStillMissing: gap && evTotal(gap) > 0 ? formatEvs(gap) : null,
              }
            : {}),
        }
      : {}),
    teraType: p.teraType,
    // What the in-game Judge said about its IVs, when the player has had it judged.
    judgePotential: potentialLevel(p.potential)?.label ?? null,
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
  const build = describeBuild(p, hasEvs, hasTarget);
  const pending = [
    p.itemStatus === 'PENDING' && (p.item?.nameEn ?? p.itemNote),
    ...p.moves.filter((m) => m.status === 'PENDING').map((m) => m.move?.nameEn ?? m.rawName),
  ].filter(Boolean);
  const illegal = p.moves.filter((m) => m.legal === false).map((m) => m.move!.nameEn);

  // Everything it can legally have in this game, so suggestions come from real options.
  const pool = await learnableMoves(game, p.species.id);
  const legalMovePool = {
    eggMoves: pool.egg.map((m) => m.nameEn),
    learnedNormally: pool.other.map((m) => m.nameEn),
  };

  return cached(
    provider,
    { kind: 'build', profileId, rosterPokemonId: p.id, refresh, lang },
    { build, pending, illegal, legalMovePool, lang },
    {
      system: system(game, lang),
      schema: hasEvs ? BuildAuditSchema : BuildAuditNoEvSchema,
      schemaName: 'build_audit',
      // Item and EV advice depends on how this game works, so let it look things up.
      webSearch: true,
      // One Pokémon at a time is the everyday request; "deeper" is the user's choice.
      tier: deep ? 'deep' : 'bulk',
      prompt: [
        'Audit this Pokémon as it is right now and say how to get the most out of it.',
        JSON.stringify({ pokemon: build, legalMovePool }, null, 2),
        hasEvs
          ? 'Work with what it already has. Its current nature, ability, potential, current EVs, held item and the moves it already knows are the starting point. ' +
            'Do not propose rebuilding it.'
          : `Work with what it already has. ${game.name} has no EV training, so ignore EVs entirely. Its nature, ability, potential, held item and the moves it already knows are the starting point. ` +
            'Do not propose rebuilding it.',
        `changes: at most three, easiest and most valuable first. effort "easy" means ${
          hasEvs ? 'EV training, ' : ''
        }a held item, or a move it can relearn; "medium" means crafting or buying a TM; "hard" means breeding, or changing its nature or ability. ` +
          'Only propose a nature or ability change if nothing else comes close, and mark it hard.',
        hasTarget
          ? 'evPlan: compare currentEvs with the best spread for its nature, base stats and moves (at most 510 in total and 252 in one stat). ' +
            'If currentEvs is null, say it is not recorded and base the plan on targetEvs. spread is the spread to finish with, ' +
            'toTrain is exactly what is still missing from currentEvs, and steps are practical ways to get those EVs in this game ' +
            `(Power items, vitamins, EV-reducing berries, where to battle). Look up how ${game.name} handles EV training if you are not sure.` +
            (game.evNote ? ` About EV training in this game: ${game.evNote}` : '')
          : hasEvs
            ? 'evPlan: its EVs are hard to change in this game, so take currentEvs as given and do not suggest starting over. ' +
              'If currentEvs is null, say it is not recorded and give general advice only. spread is currentEvs with only the smallest ' +
              'worthwhile tweaks (spare points up to 510, or a small move between stats); toTrain is those tweaks only, or "nothing" if it is fine as it is; ' +
              'steps are how to apply them, and only mention items that actually help (vitamins, feathers or wings, EV-reducing berries). ' +
              'Choose the held item and the moves that suit the EVs it already has.' +
              (game.evNote ? ` About EV training in this game: ${game.evNote}` : '')
            : '',
        hasEvs
          ? 'If currentEvsAreEstimated is true, the EVs were worked out from its stats assuming IVs of about assumedIvPerStat in each stat (taken from its judge potential, or 31 when that is not set), so treat them as approximate, especially for Attack, Defense, Sp. Atk. and Sp. Def. with a boosting or lowering nature.'
          : '',
        'heldItem: the best held item for it as it is now. If the one it holds is already the best, name it and say to keep it.',
        `recommendedMoves: the best four moves for it given its nature${hasEvs ? ' and EVs' : ''}, chosen ONLY from legalMovePool. ` +
          'Prefer moves it already knows over ones it would have to get.',
        illegal.length
          ? `Game data says this Pokémon cannot learn: ${illegal.join(', ')}. Replace each with a move from legalMovePool.`
          : '',
        pending.length
          ? `The player does not have these yet: ${pending.join(', ')}. For each, look up where to get it in ${game.name} ` +
            '(shop, location, TM number and the materials needed to craft it, or how the move is learned) and put it in howToGet.'
          : 'Nothing is pending, so leave howToGet empty.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    }
  );
}

export function auditTeam(provider: AiProvider, game: GameConfig, lang: Lang, profileId: string, roster: RosterView[]) {
  const team = roster.map((p) => describeBuild(p, game.features.evs, game.features.evTarget));
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
      `Where can ${pokemon} be caught in the wild in ${game.name}? List up to four of the best places with the area ` +
      'name and useful details (level range, time of day, raid-only, DLC area). If it cannot be caught in the wild, ' +
      'set found to false and explain in notes how it is obtained instead.',
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
