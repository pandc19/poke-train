import { Prisma } from '@prisma/client';
import { apiError } from '@/lib/api-error';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { LOCAL_USER_ID } from '@/lib/constants';
import { rosterGenderToPokedex } from '@/lib/gender-sync';
import { getGame } from '@/lib/games';
import { parseEvs } from '@/lib/import/evs';
import { TYPE_SLUGS } from '@/lib/pokemon-types';
import { loadRoster, refreshLegality } from '@/lib/roster';

const Status = z.enum(['PENDING', 'DONE']);
const id = z.number().int().positive().nullable();

const Body = z.object({
  /** Flip one micro-task. */
  task: z
    .object({
      key: z.union([z.enum(['owned', 'nature', 'ability', 'item', 'evs']), z.string().regex(/^move:[1-4]$/)]),
      status: Status,
    })
    .optional(),
  /** Edit the build itself. Changing what a task targets resets it to PENDING. */
  set: z
    .object({
      nickname: z.string().max(60).nullable(),
      gender: z.enum(['MALE', 'FEMALE', 'BOTH', 'GENDERLESS', 'UNKNOWN']),
      targetNatureId: id,
      abilityId: id,
      itemId: id,
      itemNote: z.string().max(200).nullable(),
      evs: z.string().max(200).nullable(),
      currentEvs: z.string().max(200).nullable(),
      teraType: z.enum(TYPE_SLUGS as [string, ...string[]]).nullable(),
      potential: z.enum(['DECENT', 'ABOVE_AVERAGE', 'RELATIVELY_SUPERIOR', 'OUTSTANDING']).nullable(),
      notes: z.string().max(4000).nullable(),
      moves: z.array(z.object({ slot: z.number().int().min(1).max(4), moveId: id })).max(4),
    })
    .partial()
    .optional(),
});

async function findOwned(rosterId: string) {
  if (!z.uuid().safeParse(rosterId).success) return null;
  return prisma.rosterPokemon.findFirst({
    where: { id: rosterId, profile: { userId: LOCAL_USER_ID } },
    include: { moves: true, profile: { select: { gameId: true } } },
  });
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/roster/[id]'>) {
  const { id: rosterId } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('Invalid body', 400);
  const current = await findOwned(rosterId);
  if (!current) return apiError('Not found', 404);
  const { task, set } = parsed.data;

  if (task) {
    const { key, status } = task;
    if (key.startsWith('move:')) {
      await prisma.rosterMove.updateMany({
        where: { rosterPokemonId: rosterId, slot: Number(key.slice(5)) },
        data: { status },
      });
    } else {
      await prisma.rosterPokemon.update({
        where: { id: rosterId },
        data:
          key === 'owned'
            ? { owned: status === 'DONE' }
            : key === 'nature'
              ? { natureStatus: status }
              : key === 'ability'
                ? { abilityStatus: status }
                : key === 'item'
                  ? { itemStatus: status }
                  : { evStatus: status },
      });
      // Getting a Pokémon whose gender is already set records that gender in the Pokédex.
      if (key === 'owned' && status === 'DONE' && !current.owned) {
        await rosterGenderToPokedex(prisma, {
          profileId: current.profileId,
          speciesId: current.speciesId,
          rosterId,
          before: 'UNKNOWN',
          after: set?.gender ?? current.gender,
        });
      }
    }
  }

  if (set) {
    let currentEvs: ReturnType<typeof parseEvs> | undefined;
    if (set.currentEvs !== undefined) {
      currentEvs = set.currentEvs ? parseEvs(set.currentEvs) : null;
      if (set.currentEvs && !currentEvs) {
        return apiError('EV spread not recognised. Example: 252 Atk / 4 SpD / 252 Spe', 422);
      }
    }
    let evs: ReturnType<typeof parseEvs> | undefined;
    if (set.evs !== undefined) {
      evs = set.evs ? parseEvs(set.evs) : null;
      if (set.evs && !evs) {
        return apiError('EV spread not recognised. Example: 252 Atk / 4 SpD / 252 Spe', 422);
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.rosterPokemon.update({
        where: { id: rosterId },
        data: {
          nickname: set.nickname,
          gender: set.gender,
          notes: set.notes,
          teraType: set.teraType,
          potential: set.potential,
          itemNote: set.itemNote,
          ...(set.targetNatureId !== undefined && set.targetNatureId !== current.targetNatureId
            ? {
                targetNatureId: set.targetNatureId,
                natureStatus: set.targetNatureId != null && set.targetNatureId === current.currentNatureId ? 'DONE' : 'PENDING',
              }
            : {}),
          ...(set.abilityId !== undefined && set.abilityId !== current.abilityId
            ? { abilityId: set.abilityId, abilityStatus: 'PENDING' }
            : {}),
          ...(set.itemId !== undefined && set.itemId !== current.itemId
            ? { itemId: set.itemId, itemStatus: 'PENDING' }
            : {}),
          ...(currentEvs !== undefined ? { currentEvs: currentEvs ?? Prisma.DbNull } : {}),
          ...(evs !== undefined
            ? {
                evs: evs ?? Prisma.DbNull,
                ...(JSON.stringify(evs) !== JSON.stringify(current.evs) ? { evStatus: 'PENDING' as const } : {}),
              }
            : {}),
        },
      });
      for (const m of set.moves ?? []) {
        const existing = current.moves.find((x) => x.slot === m.slot);
        if (m.moveId == null) {
          if (existing) await tx.rosterMove.delete({ where: { id: existing.id } });
        } else if (!existing) {
          await tx.rosterMove.create({ data: { rosterPokemonId: rosterId, slot: m.slot, moveId: m.moveId } });
        } else if (existing.moveId !== m.moveId) {
          await tx.rosterMove.update({
            where: { id: existing.id },
            data: { moveId: m.moveId, rawName: null, status: 'PENDING', legal: null },
          });
        }
      }
    });
    const game = getGame(current.profile.gameId);
    if (set.moves && game) await refreshLegality(rosterId, game);

    // A gender set on an obtained Pokémon is also recorded in the Pokédex.
    if (set.gender !== undefined && set.gender !== current.gender && current.owned) {
      await rosterGenderToPokedex(prisma, {
        profileId: current.profileId,
        speciesId: current.speciesId,
        rosterId,
        before: current.gender,
        after: set.gender,
      });
    }
  }

  const [view] = await loadRoster(current.profileId, [rosterId]);
  return Response.json({ pokemon: view });
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/roster/[id]'>) {
  const { id: rosterId } = await ctx.params;
  const current = await findOwned(rosterId);
  if (!current) return apiError('Not found', 404);
  await prisma.rosterPokemon.delete({ where: { id: rosterId } });
  return Response.json({ ok: true });
}
