import { z } from 'zod';
import { prisma } from '@/lib/db';
import { findProfileId } from '@/lib/profile';
import { loadRoster } from '@/lib/roster';

const Body = z.object({ gameId: z.string(), speciesId: z.number().int().positive() });

/** Adds an empty roster entry for a species; the build is filled in afterwards. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const profileId = await findProfileId(parsed.data.gameId);
  if (!profileId) return Response.json({ error: 'Unknown game' }, { status: 404 });
  const species = await prisma.species.findUnique({ where: { id: parsed.data.speciesId }, select: { id: true } });
  if (!species) return Response.json({ error: 'Unknown Pokémon' }, { status: 404 });

  const last = await prisma.rosterPokemon.aggregate({ where: { profileId }, _max: { sortOrder: true } });
  const created = await prisma.rosterPokemon.create({
    data: { profileId, speciesId: species.id, sortOrder: (last._max.sortOrder ?? 0) + 1 },
  });
  const [view] = await loadRoster(profileId, [created.id]);
  return Response.json({ pokemon: view });
}
