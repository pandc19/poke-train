import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { AiError, NO_AI_MESSAGE, getAiProvider } from '@/lib/ai';
import { researchLocation, savedLocation } from '@/lib/ai/tasks';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';
import { getLang } from '@/lib/i18n';
import { findProfileId } from '@/lib/profile';

const Body = z.object({
  gameId: z.string(),
  speciesId: z.number().int().positive(),
  /** Research it again instead of using the saved answer. */
  refresh: z.boolean().default(false),
});

/**
 * Where to catch a Pokémon. PokéAPI has no encounter data for recent games,
 * so this is the one lookup that goes to web research (cached per species).
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('Invalid body', 400);
  const game = getGame(parsed.data.gameId);
  const profileId = await findProfileId(parsed.data.gameId);
  const species = await prisma.species.findUnique({ where: { id: parsed.data.speciesId }, select: { nameEn: true } });
  if (!game || !profileId || !species) return apiError('Not found', 404);

  const provider = getAiProvider();
  if (!provider) return apiError(NO_AI_MESSAGE, 503);
  try {
    const result = await researchLocation(provider, game, await getLang(), profileId, species.nameEn, parsed.data.refresh);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof AiError) return apiError(error.message, 502, error.vars);
    throw error;
  }
}

/** Answers already researched, for a list of species. Makes no request to the model. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const game = getGame(params.get('gameId') ?? '');
  const ids = (params.get('speciesIds') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  const provider = getAiProvider();
  if (!game || !provider || ids.length === 0) return Response.json({ results: {} });

  const lang = await getLang();
  const species = await prisma.species.findMany({ where: { id: { in: ids } }, select: { id: true, nameEn: true } });
  const results: Record<number, unknown> = {};
  await Promise.all(
    species.map(async (s) => {
      const saved = await savedLocation(provider, game, lang, s.nameEn);
      if (saved) results[s.id] = saved;
    })
  );
  return Response.json({ results });
}
