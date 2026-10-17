import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { learnableMoves } from '@/lib/breeding/moves';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';

const Query = z.object({ gameId: z.string(), speciesId: z.coerce.number().int().positive() });

/** The moves a Pokémon can have in a game, for the breeding form's pickers. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = Query.safeParse({
    gameId: url.searchParams.get('gameId'),
    speciesId: url.searchParams.get('speciesId'),
  });
  if (!parsed.success) return apiError('Invalid query', 400);
  const game = getGame(parsed.data.gameId);
  if (!game) return apiError('Unknown game', 404);
  const [moves, hidden] = await Promise.all([
    learnableMoves(game, parsed.data.speciesId),
    // The hidden ability the offspring would have: the one of the Pokémon's own (default) form.
    prisma.formAbility.findFirst({
      where: { isHidden: true, form: { speciesId: parsed.data.speciesId, isDefault: true } },
      select: { ability: { select: { id: true, nameEn: true, nameEs: true } } },
    }),
  ]);
  return Response.json({ ...moves, hiddenAbility: hidden?.ability ?? null });
}
