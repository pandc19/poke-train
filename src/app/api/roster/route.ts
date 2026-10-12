import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { prisma } from '@/lib/db';
import { findProfileId } from '@/lib/profile';
import { loadRoster } from '@/lib/roster';

const Body = z.object({ gameId: z.string(), speciesId: z.number().int().positive() });

/** Adds an empty roster entry for a species; the build is filled in afterwards. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('Invalid body', 400);
  const profileId = await findProfileId(parsed.data.gameId);
  if (!profileId) return apiError('Unknown game', 404);
  const species = await prisma.species.findUnique({ where: { id: parsed.data.speciesId }, select: { id: true } });
  if (!species) return apiError('Unknown Pokémon', 404);

  const last = await prisma.rosterPokemon.aggregate({ where: { profileId }, _max: { sortOrder: true } });
  const created = await prisma.rosterPokemon.create({
    data: { profileId, speciesId: species.id, sortOrder: (last._max.sortOrder ?? 0) + 1 },
  });
  const [view] = await loadRoster(profileId, [created.id]);
  return Response.json({ pokemon: view });
}
