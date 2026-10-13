import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { IV_STATS } from '@/lib/breeding/engine';
import { loadGoals } from '@/lib/breeding/goals';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';
import { findProfileId } from '@/lib/profile';

const Body = z.object({
  gameId: z.string(),
  speciesId: z.number().int().positive(),
  moveIds: z.array(z.number().int().positive()).max(4),
  ivTargets: z.array(z.enum(IV_STATS)).max(6).default([]),
  natureId: z.number().int().positive().nullable().default(null),
  hiddenAbility: z.boolean().default(false),
});

/** Creates a breeding goal and its plan. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('Invalid body', 400);
  const { gameId, speciesId } = parsed.data;
  const moveIds = [...new Set(parsed.data.moveIds)];

  const game = getGame(gameId);
  const profileId = await findProfileId(gameId);
  if (!game || !profileId) return apiError('Unknown game', 404);
  if (!game.features.breeding) return apiError('{game} has no breeding.', 422, { game: game.name });

  const species = await prisma.species.findUnique({ where: { id: speciesId }, select: { id: true } });
  if (!species) return apiError('Unknown Pokémon', 404);

  const { ivTargets, natureId, hiddenAbility } = parsed.data;
  const goal = await prisma.breedingGoal.create({
    data: { profileId, speciesId, moveIds, ivTargets: [...new Set(ivTargets)], natureId, hiddenAbility },
  });
  const [view] = await loadGoals(game, profileId, [goal.id]);
  return Response.json({ goal: view });
}
