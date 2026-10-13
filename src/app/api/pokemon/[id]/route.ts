import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { REGIONS } from '@/lib/dex-variant';
import { getGame } from '@/lib/games';
import { loadPokemonInfo } from '@/lib/pokeapi/info';

const Params = z.object({ id: z.coerce.number().int().positive() });

/** Pokédex information about one species, from PokéAPI data. Never reads the roster. */
export async function GET(request: Request, ctx: RouteContext<'/api/pokemon/[id]'>) {
  const parsed = Params.safeParse(await ctx.params);
  if (!parsed.success) return apiError('Invalid id', 400);
  const gameId = new URL(request.url).searchParams.get('gameId');
  const game = gameId ? getGame(gameId) : undefined;
  const asked = new URL(request.url).searchParams.get('variant');
  const variant = REGIONS.find((r) => r === asked) ?? '';

  try {
    const info = await loadPokemonInfo(parsed.data.id, game, variant);
    if (!info) return apiError('Unknown Pokémon', 404);
    return Response.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    return apiError('Could not load the Pokémon data: {message}', 502, { message });
  }
}
