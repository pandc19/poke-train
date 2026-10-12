import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { loadGoals } from '@/lib/breeding/goals';
import { LOCAL_USER_ID } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';

const Body = z.object({ status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE']) });

async function findGoal(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return prisma.breedingGoal.findFirst({
    where: { id, profile: { userId: LOCAL_USER_ID } },
    include: { profile: { select: { gameId: true } } },
  });
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/breeding/[id]'>) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('Invalid body', 400);
  const goal = await findGoal(id);
  const game = goal && getGame(goal.profile.gameId);
  if (!goal || !game) return apiError('Not found', 404);

  await prisma.breedingGoal.update({ where: { id }, data: { status: parsed.data.status } });
  const [view] = await loadGoals(game, goal.profileId, [id]);
  return Response.json({ goal: view });
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/breeding/[id]'>) {
  const { id } = await ctx.params;
  const goal = await findGoal(id);
  if (!goal) return apiError('Not found', 404);
  await prisma.breedingGoal.delete({ where: { id } });
  return Response.json({ ok: true });
}
