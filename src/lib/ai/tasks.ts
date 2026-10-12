import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { prisma } from '../db';
import type { GameConfig } from '../games';
import { formatEvs } from '../import/evs';
import type { Lang } from '../i18n';
import type { RosterView } from '../roster';
import { BuildAuditSchema, LocationSchema, StarterAdviceSchema, TeamAuditSchema } from './schema';
import type { AiProvider, ModelTier } from './types';

const PROMPT_VERSION = 2;

const system = (game: GameConfig, lang: Lang) =>
  [
    `You are a competitive Pokémon coach helping one player with ${game.name}.`,
    `Only recommend Pokémon, moves, items and mechanics that exist in ${game.name}, including its DLC.`,
    'Be specific and practical. If you are not sure where something is found, say so rather than guessing.',
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

/** A compact, language-neutral description of a build, used both as prompt and cache key. */
function describeBuild(p: RosterView) {
  return {
    pokemon: p.species.nameEn,
    types: p.types,
    nature: p.targetNature?.nameEn ?? null,
    ability: p.ability?.nameEn ?? null,
    item: p.item?.nameEn ?? p.itemNote,
    evs: p.evs ? formatEvs(p.evs) : null,
    teraType: p.teraType,
    // What the in-game Judge said about its IVs, when the player has had it judged.
    judgePotential: p.potential,
    moves: p.moves.map((m) => m.move?.nameEn ?? m.rawName),
  };
}

export function auditBuild(
  provider: AiProvider,
  game: GameConfig,
  lang: Lang,
  profileId: string,
  p: RosterView,
  refresh: boolean,
  deep = false
) {
  const build = describeBuild(p);
  const pending = [
    p.itemStatus === 'PENDING' && (p.item?.nameEn ?? p.itemNote),
    ...p.moves.filter((m) => m.status === 'PENDING').map((m) => m.move?.nameEn ?? m.rawName),
  ].filter(Boolean);
  const illegal = p.moves.filter((m) => m.legal === false).map((m) => m.move!.nameEn);

  return cached(
    provider,
    { kind: 'build', profileId, rosterPokemonId: p.id, refresh, lang },
    { build, pending, illegal, lang },
    {
      system: system(game, lang),
      schema: BuildAuditSchema,
      schemaName: 'build_audit',
      webSearch: pending.length > 0,
      // One Pokémon at a time is the everyday request; "deeper" is the user's choice.
      tier: deep ? 'deep' : 'bulk',
      prompt: [
        'Audit this planned build.',
        JSON.stringify(build, null, 2),
        illegal.length
          ? `Game data says this Pokémon cannot learn: ${illegal.join(', ')}. Suggest a legal replacement for each.`
          : '',
        pending.length
          ? `The player does not have these yet: ${pending.join(', ')}. For each, look up where to get it in ${game.name} ` +
            '(shop, location, TM number and the materials needed to craft it, or how the move is learned) and put it in howToGet.'
          : 'Nothing is pending, so leave howToGet empty.',
        'Judge synergy between nature, EVs, ability, item and moves. Suggest at most three upgrades.',
        'Always fill recommendedMoves with the best moveset you would run on this Pokémon in this game, even if the current moves are already good.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    }
  );
}

export function auditTeam(provider: AiProvider, game: GameConfig, lang: Lang, profileId: string, roster: RosterView[]) {
  const team = roster.map(describeBuild);
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
