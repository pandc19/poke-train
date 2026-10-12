import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { AiError, NO_AI_MESSAGE, getAiProvider } from '@/lib/ai';
import { auditTeam } from '@/lib/ai/tasks';
import { getGame } from '@/lib/games';
import { getLang } from '@/lib/i18n';
import { findProfileId } from '@/lib/profile';
import { loadRoster } from '@/lib/roster';

const Body = z.object({ gameId: z.string() });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('Invalid body', 400);
  const game = getGame(parsed.data.gameId);
  const profileId = await findProfileId(parsed.data.gameId);
  if (!game || !profileId) return apiError('Unknown game', 404);

  const provider = getAiProvider();
  if (!provider) return apiError(NO_AI_MESSAGE, 503);

  const roster = await loadRoster(profileId);
  if (!roster.length) return apiError('The roster is empty.', 422);
  try {
    const result = await auditTeam(provider, game, await getLang(), profileId, roster);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof AiError) return apiError(error.message, 502, error.vars);
    throw error;
  }
}
