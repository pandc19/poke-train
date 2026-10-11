import { z } from 'zod';
import { learnableMoves } from '@/lib/breeding/moves';
import { getGame } from '@/lib/games';

const Query = z.object({ gameId: z.string(), speciesId: z.coerce.number().int().positive() });

/** The moves a Pokémon can have in a game, for the breeding form's pickers. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = Query.safeParse({
    gameId: url.searchParams.get('gameId'),
    speciesId: url.searchParams.get('speciesId'),
  });
  if (!parsed.success) return Response.json({ error: 'Invalid query' }, { status: 400 });
  const game = getGame(parsed.data.gameId);
  if (!game) return Response.json({ error: 'Unknown game' }, { status: 404 });
  return Response.json(await learnableMoves(game, parsed.data.speciesId));
}
