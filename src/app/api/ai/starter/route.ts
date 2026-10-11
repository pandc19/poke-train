import { z } from 'zod';
import { AiError, NO_AI_MESSAGE, getAiProvider } from '@/lib/ai';
import { adviseStarterTeam } from '@/lib/ai/tasks';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';
import { getLang } from '@/lib/i18n';
import { findProfileId } from '@/lib/profile';

const Body = z.object({ gameId: z.string(), refresh: z.boolean().default(false) });

/** AI advice that adapts the utility core to what the player already owns. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const game = getGame(parsed.data.gameId);
  const profileId = await findProfileId(parsed.data.gameId);
  if (!game || !profileId) return Response.json({ error: 'Unknown game' }, { status: 404 });

  const provider = getAiProvider();
  if (!provider) return Response.json({ error: NO_AI_MESSAGE }, { status: 503 });

  const [roster, caught] = await Promise.all([
    prisma.rosterPokemon.findMany({ where: { profileId, owned: true }, select: { species: { select: { nameEn: true } } } }),
    prisma.pokedexEntry.findMany({ where: { profileId }, select: { species: { select: { nameEn: true } } }, take: 150 }),
  ]);
  const owned = [...new Set([...roster, ...caught].map((r) => r.species.nameEn))].sort();
  try {
    const result = await adviseStarterTeam(provider, game, await getLang(), profileId, owned, parsed.data.refresh);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof AiError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
