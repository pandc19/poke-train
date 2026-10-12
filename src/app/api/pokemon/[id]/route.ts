import { z } from 'zod';
import { getGame } from '@/lib/games';
import { loadPokemonInfo } from '@/lib/pokeapi/info';

const Params = z.object({ id: z.coerce.number().int().positive() });

/** Pokédex information about one species, from PokéAPI data. Never reads the roster. */
export async function GET(request: Request, ctx: RouteContext<'/api/pokemon/[id]'>) {
  const parsed = Params.safeParse(await ctx.params);
  if (!parsed.success) return Response.json({ error: 'Invalid id' }, { status: 400 });
  const gameId = new URL(request.url).searchParams.get('gameId');
  const game = gameId ? getGame(gameId) : undefined;

  try {
    const info = await loadPokemonInfo(parsed.data.id, game);
    if (!info) return Response.json({ error: 'Unknown Pokémon' }, { status: 404 });
    return Response.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    return Response.json({ error: `Could not load the Pokémon data: ${message}` }, { status: 502 });
  }
}
