import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { LOCAL_USER_ID } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { variantOfSlug } from '@/lib/dex-variant';
import { rosterGenderToPokedex } from '@/lib/gender-sync';
import { getGame } from '@/lib/games';
import { loadRoster, refreshLegality } from '@/lib/roster';

const named = { id: true, nameEn: true, nameEs: true } as const;

async function findBreeder(rosterId: string) {
  if (!z.uuid().safeParse(rosterId).success) return null;
  return prisma.rosterPokemon.findFirst({
    where: { id: rosterId, profile: { userId: LOCAL_USER_ID } },
    include: {
      profile: { select: { gameId: true } },
      form: { select: { slug: true } },
      roles: { select: { role: true } },
      species: { select: { ...named, evolvesFromId: true } },
    },
  });
}

/** Every other stage of its line that exists in the game: the ones before (nearest first) and after. */
async function stagesOf(gameId: string, speciesId: number, evolvesFromId: number | null) {
  const inGame = { pokedexSlots: { some: { pokedex: { gameId } } } };
  const before: { id: number; nameEn: string; nameEs: string }[] = [];
  for (let from = evolvesFromId, guard = 0; from != null && guard < 5; guard++) {
    const sp = await prisma.species.findUnique({ where: { id: from }, select: { ...named, evolvesFromId: true } });
    if (!sp) break;
    if (await prisma.species.count({ where: { id: sp.id, ...inGame } })) before.push({ id: sp.id, nameEn: sp.nameEn, nameEs: sp.nameEs });
    from = sp.evolvesFromId;
  }
  const after: { id: number; nameEn: string; nameEs: string }[] = [];
  let level = [speciesId];
  for (let guard = 0; level.length > 0 && guard < 5; guard++) {
    const next = await prisma.species.findMany({
      where: { evolvesFromId: { in: level }, ...inGame },
      select: named,
      orderBy: { id: 'asc' },
    });
    after.push(...next);
    level = next.map((n) => n.id);
  }
  return { before, after };
}

/** Which stages a breeder can be switched to, so the page can offer them. */
export async function GET(_request: Request, ctx: RouteContext<'/api/roster/[id]/evolve'>) {
  const { id } = await ctx.params;
  const current = await findBreeder(id);
  if (!current) return apiError('Not found', 404);
  if (current.roles.some((r) => r.role === 'ROSTER')) return Response.json({ before: [], after: [] });
  return Response.json(await stagesOf(current.profile.gameId, current.speciesId, current.species.evolvesFromId));
}

const Body = z.object({ speciesId: z.number().int().positive() });

/**
 * Swaps a breeder for another stage of its line (you caught a Slakoth with better IVs than your
 * Slaking). Moves, IVs, nature and the rest stay; the species, form and, if it no longer fits, the ability
 * change. The Pokédex only gains the new stage if it was not registered yet.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/roster/[id]/evolve'>) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('Invalid body', 400);
  const current = await findBreeder(id);
  const game = current && getGame(current.profile.gameId);
  if (!current || !game) return apiError('Not found', 404);
  if (current.roles.some((r) => r.role === 'ROSTER')) {
    return apiError('A Pokémon on the roster cannot change stage here', 409);
  }

  const { before, after } = await stagesOf(game.id, current.speciesId, current.species.evolvesFromId);
  const target = [...before, ...after].find((s) => s.id === parsed.data.speciesId);
  if (!target) return apiError('That is not a stage of this Pokémon’s line', 400);

  // Same variety when the new stage has one (a Galarian form stays Galarian), otherwise its normal form.
  const variant = variantOfSlug(current.form?.slug ?? '');
  const forms = await prisma.form.findMany({
    where: { speciesId: target.id },
    select: { id: true, slug: true, isDefault: true, abilities: { select: { abilityId: true, isHidden: true } } },
  });
  const form = forms.find((f) => variant !== '' && variantOfSlug(f.slug) === variant) ?? forms.find((f) => f.isDefault);
  if (!form) return apiError('No form for that Pokémon', 400);

  // The ability stays if the new stage has it; a hidden ability moves to the new stage's hidden one.
  let abilityId = current.abilityId;
  if (abilityId != null && !form.abilities.some((a) => a.abilityId === abilityId)) {
    const wasHidden = await prisma.formAbility.findFirst({
      where: { abilityId, form: { speciesId: current.speciesId } },
      select: { isHidden: true },
    });
    const hidden = form.abilities.filter((a) => a.isHidden);
    abilityId = wasHidden?.isHidden && hidden.length === 1 ? hidden[0].abilityId : null;
  }

  const targetVariant = variantOfSlug(form.slug);
  await prisma.$transaction(async (tx) => {
    await tx.rosterPokemon.update({
      where: { id },
      data: {
        speciesId: target.id,
        formId: form.isDefault ? null : form.id,
        abilityId,
        ...(abilityId !== current.abilityId ? { abilityStatus: 'PENDING' as const } : {}),
      },
    });
    const key = { profileId: current.profileId, speciesId: target.id, variant: targetVariant };
    const known = await tx.pokedexEntry.findUnique({
      where: { profileId_speciesId_variant: key },
      select: { speciesId: true },
    });
    if (!known) {
      await tx.pokedexEntry.create({ data: { ...key, owned: current.owned } });
      if (current.owned) {
        await rosterGenderToPokedex(tx, { ...key, rosterId: id, before: 'UNKNOWN', after: current.gender });
      }
    }
  });
  await refreshLegality(id, game);

  const [pokemon] = await loadRoster(current.profileId, [id]);
  return Response.json({ pokemon });
}
