import { z } from 'zod';
import { computePlan, loadGoals } from '@/lib/breeding/goals';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';
import { findProfileId } from '@/lib/profile';

const Body = z.object({
  gameId: z.string(),
  speciesId: z.number().int().positive(),
  moveIds: z.array(z.number().int().positive()).max(4),
});

/** Creates a breeding goal and its plan. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const { gameId, speciesId } = parsed.data;
  const moveIds = [...new Set(parsed.data.moveIds)];

  const game = getGame(gameId);
  const profileId = await findProfileId(gameId);
  if (!game || !profileId) return Response.json({ error: 'Unknown game' }, { status: 404 });
  if (!game.features.breeding) return Response.json({ error: `${game.name} has no breeding.` }, { status: 422 });

  const plan = await computePlan(game, profileId, speciesId, moveIds);
  if (!plan) return Response.json({ error: 'Unknown Pokémon' }, { status: 404 });

  const goal = await prisma.breedingGoal.create({ data: { profileId, speciesId, moveIds, plan } });
  const [view] = await loadGoals(profileId, [goal.id]);
  return Response.json({ goal: view });
}
