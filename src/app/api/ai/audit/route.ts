import { z } from 'zod';
import { AiError, NO_AI_MESSAGE, getAiProvider } from '@/lib/ai';
import { auditBuild } from '@/lib/ai/tasks';
import { LOCAL_USER_ID } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';
import { getLang } from '@/lib/i18n';
import { loadRoster } from '@/lib/roster';

const Body = z.object({
  rosterPokemonId: z.uuid(),
  refresh: z.boolean().default(false),
  /** Use the stronger escalation model instead of the everyday one. */
  deep: z.boolean().default(false),
});

/** Runs (or returns the cached) AI audit of one roster build. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const provider = getAiProvider();
  if (!provider) return Response.json({ error: NO_AI_MESSAGE }, { status: 503 });

  const row = await prisma.rosterPokemon.findFirst({
    where: { id: parsed.data.rosterPokemonId, profile: { userId: LOCAL_USER_ID } },
    select: { profileId: true, profile: { select: { gameId: true } } },
  });
  const game = row && getGame(row.profile.gameId);
  if (!row || !game) return Response.json({ error: 'Not found' }, { status: 404 });

  const [pokemon] = await loadRoster(row.profileId, [parsed.data.rosterPokemonId]);
  try {
    await auditBuild(provider, game, await getLang(), row.profileId, pokemon, parsed.data.refresh, parsed.data.deep);
  } catch (error) {
    if (error instanceof AiError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
  const [updated] = await loadRoster(row.profileId, [parsed.data.rosterPokemonId]);
  return Response.json({ pokemon: updated });
}
