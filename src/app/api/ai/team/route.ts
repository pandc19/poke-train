import { z } from 'zod';
import { AiError, NO_AI_MESSAGE, getAiProvider } from '@/lib/ai';
import { auditTeam } from '@/lib/ai/tasks';
import { getGame } from '@/lib/games';
import { getLang } from '@/lib/i18n';
import { findProfileId } from '@/lib/profile';
import { loadRoster } from '@/lib/roster';

const Body = z.object({ gameId: z.string() });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const game = getGame(parsed.data.gameId);
  const profileId = await findProfileId(parsed.data.gameId);
  if (!game || !profileId) return Response.json({ error: 'Unknown game' }, { status: 404 });

  const provider = getAiProvider();
  if (!provider) return Response.json({ error: NO_AI_MESSAGE }, { status: 503 });

  const roster = await loadRoster(profileId);
  if (!roster.length) return Response.json({ error: 'The roster is empty.' }, { status: 422 });
  try {
    const result = await auditTeam(provider, game, await getLang(), profileId, roster);
    return Response.json({ result });
  } catch (error) {
    if (error instanceof AiError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
