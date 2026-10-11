import { z } from 'zod';
import { prisma } from '@/lib/db';
import { findProfileId } from '@/lib/profile';

const Body = z.object({
  gameId: z.string(),
  speciesIds: z.array(z.number().int().positive()).min(1).max(2000),
  caught: z.boolean(),
});

/** Batch-sets caught state for a profile. Idempotent in both directions. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const { gameId, speciesIds, caught } = parsed.data;

  const profileId = await findProfileId(gameId);
  if (!profileId) return Response.json({ error: 'Unknown game' }, { status: 404 });

  if (caught) {
    await prisma.pokedexEntry.createMany({
      data: speciesIds.map((speciesId) => ({ profileId, speciesId })),
      skipDuplicates: true,
    });
  } else {
    await prisma.pokedexEntry.deleteMany({ where: { profileId, speciesId: { in: speciesIds } } });
  }
  return Response.json({ ok: true });
}
