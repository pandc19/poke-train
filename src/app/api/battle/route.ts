import { apiError } from '@/lib/api-error';
import { checkOpponent, opponentError, CreateBody } from '@/lib/battle/input';
import { loadOpponents } from '@/lib/battle/load';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';
import { findProfileId } from '@/lib/profile';

/** Saves an opponent to battle. Cloning is this call with the copied values and the change. */
export async function POST(request: Request) {
  const parsed = CreateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('Invalid body', 400);
  const { gameId, ...body } = parsed.data;
  const game = getGame(gameId);
  const profileId = await findProfileId(gameId);
  if (!game || !profileId) return apiError('Unknown game', 404);

  const checked = await checkOpponent(game, {
    speciesId: body.speciesId,
    formId: body.formId ?? null,
    kind: body.kind ?? 'STANDARD',
    teraType: body.teraType ?? null,
    stars: body.stars ?? null,
    abilityId: body.abilityId ?? null,
    moveIds: body.moveIds ?? [],
    label: body.label ?? null,
    notes: body.notes ?? null,
  });
  if ('error' in checked) return opponentError(checked.error);

  const row = await prisma.battleOpponent.create({ data: { profileId, ...checked.data } });
  const [opponent] = await loadOpponents(game, profileId, [row.id]);
  return Response.json({ opponent });
}
