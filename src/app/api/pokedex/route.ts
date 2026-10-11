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

const GenderBody = z.object({
  gameId: z.string(),
  speciesId: z.number().int().positive(),
  hasMale: z.boolean().optional(),
  hasFemale: z.boolean().optional(),
  /** You have one right now (false = it evolved or was released). */
  owned: z.boolean().optional(),
});

/** Records whether you have a species now and which genders (also marks it caught). */
export async function PATCH(request: Request) {
  const parsed = GenderBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const { gameId, speciesId, hasMale, hasFemale, owned } = parsed.data;

  const profileId = await findProfileId(gameId);
  if (!profileId) return Response.json({ error: 'Unknown game' }, { status: 404 });

  const data = { hasMale, hasFemale, owned };
  await prisma.pokedexEntry.upsert({
    where: { profileId_speciesId: { profileId, speciesId } },
    update: data,
    create: { profileId, speciesId, ...data },
  });
  return Response.json({ ok: true });
}
