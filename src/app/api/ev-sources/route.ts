import { apiError } from '@/lib/api-error';
import { STAT_NAMES, loadEvSources } from '@/lib/ev-catalog';
import type { EvSpread } from '@/lib/import/evs';
import { getGame } from '@/lib/games';

/**
 * Every Pokémon of this game that gives EVs in one stat, best to battle first,
 * with each evolution line kept together in evolution order.
 * It comes from the games' own data (no AI): the audit shows only the top few.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const game = getGame(params.get('gameId') ?? '');
  // The stat by its key ('specialAttack') or by the name the audit uses ('Sp. Atk').
  const asked = params.get('stat');
  const stat = (Object.keys(STAT_NAMES) as (keyof EvSpread)[]).find((k) => k === asked || STAT_NAMES[k] === asked);
  if (!game || !stat) return apiError('Invalid query', 400);
  const [group] = await loadEvSources(game.id, [stat], Infinity, true);
  return Response.json({ species: group?.species ?? [] });
}
