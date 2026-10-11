import { z } from 'zod';
import { AiError, NO_AI_MESSAGE, getAiProvider } from '@/lib/ai';
import { researchLocation } from '@/lib/ai/tasks';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';
import { getLang } from '@/lib/i18n';
import { findProfileId } from '@/lib/profile';

const Body = z.object({ gameId: z.string(), speciesId: z.number().int().positive() });

/**
 * Where to catch a Pokémon. PokéAPI has no encounter data for recent games,
 * so this is the one lookup that goes to web research (cached per species).
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const game = getGame(parsed.data.gameId);
  const profileId = await findProfileId(parsed.data.gameId);
  const species = await prisma.species.findUnique({ where: { id: parsed.data.speciesId }, select: { nameEn: true } });
  if (!game || !profileId || !species) return Response.json({ error: 'Not found' }, { status: 404 });

  const provider = getAiProvider();
  if (!provider) return Response.json({ error: NO_AI_MESSAGE }, { status: 503 });
  try {
    const result = await researchLocation(provider, game, await getLang(), profileId, species.nameEn);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof AiError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
