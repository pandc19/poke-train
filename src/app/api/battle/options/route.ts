import { apiError } from '@/lib/api-error';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';

/** The forms of a species that exist in the game (default form always), with their abilities. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = getGame(url.searchParams.get('gameId') ?? '');
  const speciesId = Number(url.searchParams.get('speciesId'));
  if (!game || !Number.isInteger(speciesId) || speciesId <= 0) return apiError('Invalid query', 400);

  const forms = await prisma.form.findMany({
    where: {
      speciesId,
      OR: [{ isDefault: true }, { learnsets: { some: { versionGroup: { in: game.learnsetVersionGroups } } } }],
    },
    orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      slug: true,
      isDefault: true,
      types: true,
      spriteUrl: true,
      abilities: {
        select: { isHidden: true, ability: { select: { id: true, nameEn: true, nameEs: true } } },
      },
    },
  });
  return Response.json({
    forms: forms.map((f) => ({
      id: f.id,
      slug: f.slug,
      isDefault: f.isDefault,
      types: f.types,
      spriteUrl: f.spriteUrl,
      abilities: f.abilities.map((a) => ({ ...a.ability, isHidden: a.isHidden })),
    })),
  });
}
