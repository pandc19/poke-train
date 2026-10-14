import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { loadHatchHelpers } from '@/lib/breeding/hatch';
import { getGame } from '@/lib/games';
import { findProfileId } from '@/lib/profile';

const Query = z.object({ gameId: z.string() });

/** The Pokémon of a game whose ability makes eggs hatch faster, and which ones the player has. */
export async function GET(request: Request) {
  const parsed = Query.safeParse({ gameId: new URL(request.url).searchParams.get('gameId') });
  if (!parsed.success) return apiError('Invalid query', 400);
  const game = getGame(parsed.data.gameId);
  const profileId = await findProfileId(parsed.data.gameId);
  if (!game || !profileId) return apiError('Unknown game', 404);
  return Response.json({ helpers: await loadHatchHelpers(game, profileId) });
}
