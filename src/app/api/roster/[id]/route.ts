import { AuditLocksSchema } from '@/lib/audit-locks';
import { Prisma } from '@prisma/client';
import { apiError } from '@/lib/api-error';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { LOCAL_USER_ID } from '@/lib/constants';
import { recomputeEvsFromStats, syncEvStatus } from '@/lib/ev-sync';
import { rosterGenderToPokedex } from '@/lib/gender-sync';
import { getGame } from '@/lib/games';
import { parseEvs } from '@/lib/import/evs';
import { IV_RATING_VALUES, potentialFromRatings, type IvRatings } from '@/lib/iv-ratings';
import { TYPE_SLUGS } from '@/lib/pokemon-types';
import { loadRoster, refreshLegality } from '@/lib/roster';

const Status = z.enum(['PENDING', 'DONE']);
const id = z.number().int().positive().nullable();

const Body = z.object({
  /** Flip one micro-task. */
  task: z
    .object({
      key: z.union([z.enum(['owned', 'nature', 'ability', 'item', 'tera', 'evs']), z.string().regex(/^move:[1-4]$/)]),
      status: Status,
    })
    .optional(),
  /** Edit the build itself. Changing what a task targets resets it to PENDING. */
  set: z
    .object({
      nickname: z.string().max(60).nullable(),
      gender: z.enum(['MALE', 'FEMALE', 'BOTH', 'GENDERLESS', 'UNKNOWN']),
      targetNatureId: id,
      /** The nature it really has (breeders record this one). */
      currentNatureId: id,
      abilityId: id,
      itemId: id,
      itemNote: z.string().max(200).nullable(),
      evs: z.string().max(200).nullable(),
      currentEvs: z.string().max(200).nullable(),
      currentEvsEstimated: z.boolean(),
      /** The stats the game shows; the EVs are worked out from them. */
      currentStats: z
        .object({
          hp: z.number().int().min(0).max(999),
          attack: z.number().int().min(0).max(999),
          defense: z.number().int().min(0).max(999),
          specialAttack: z.number().int().min(0).max(999),
          specialDefense: z.number().int().min(0).max(999),
          speed: z.number().int().min(0).max(999),
        })
        .nullable(),
      /** EVs gained that the stats cannot show; added to the estimate. */
      hiddenEvs: z
        .object({
          hp: z.number().int().min(0).max(252),
          attack: z.number().int().min(0).max(252),
          defense: z.number().int().min(0).max(252),
          specialAttack: z.number().int().min(0).max(252),
          specialDefense: z.number().int().min(0).max(252),
          speed: z.number().int().min(0).max(252),
        })
        .nullable(),
      level: z.number().int().min(1).max(100),
      /** What the Judge said about each stat's IV. */
      auditLocks: AuditLocksSchema.nullable(),
      ivRatings: z
        .object({
          hp: z.enum(IV_RATING_VALUES).nullable().optional(),
          attack: z.enum(IV_RATING_VALUES).nullable().optional(),
          defense: z.enum(IV_RATING_VALUES).nullable().optional(),
          specialAttack: z.enum(IV_RATING_VALUES).nullable().optional(),
          specialDefense: z.enum(IV_RATING_VALUES).nullable().optional(),
          speed: z.enum(IV_RATING_VALUES).nullable().optional(),
        })
        .nullable(),
      teraType: z.enum(TYPE_SLUGS as [string, ...string[]]).nullable(),
      potential: z.enum(['DECENT', 'ABOVE_AVERAGE', 'RELATIVELY_SUPERIOR', 'OUTSTANDING']).nullable(),
      notes: z.string().max(4000).nullable(),
      moves: z
        .array(z.object({ slot: z.number().int().min(1).max(4), moveId: id, status: Status.optional() }))
        .max(4),
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
                  : key === 'tera'
                    ? { teraStatus: status }
                    : { evStatus: status },
      });
      // A Pokémon you have is caught and in your box, so the Pokédex says so too.
      if (key === 'owned' && status === 'DONE') {
        await prisma.pokedexEntry.upsert({
          where: { profileId_speciesId: { profileId: current.profileId, speciesId: current.speciesId } },
          update: { owned: true },
          create: { profileId: current.profileId, speciesId: current.speciesId, owned: true },
        });
      }
      // Giving it up leaves it caught, but no longer in the box unless another one is.
      if (key === 'owned' && status === 'PENDING' && current.owned) {
        const others = await prisma.rosterPokemon.count({
          where: { profileId: current.profileId, speciesId: current.speciesId, owned: true, id: { not: rosterId } },
        });
        if (others === 0) {
          await prisma.pokedexEntry.updateMany({
            where: { profileId: current.profileId, speciesId: current.speciesId },
            data: { owned: false },
          });
        }
      }
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
          ...(set.teraType !== undefined && set.teraType !== current.teraType
            ? { teraStatus: set.teraType != null ? 'PENDING' : 'DONE' }
            : {}),
          potential: set.potential,
          itemNote: set.itemNote,
          ...(set.targetNatureId !== undefined && set.targetNatureId !== current.targetNatureId
            ? {
                targetNatureId: set.targetNatureId,
                natureStatus: set.targetNatureId != null && set.targetNatureId === current.currentNatureId ? 'DONE' : 'PENDING',
              }
            : {}),
          ...(set.currentNatureId !== undefined && set.currentNatureId !== current.currentNatureId
            ? {
                currentNatureId: set.currentNatureId,
                ...(current.targetNatureId != null
                  ? { natureStatus: set.currentNatureId === current.targetNatureId ? ('DONE' as const) : ('PENDING' as const) }
                  : {}),
              }
            : {}),
          ...(set.abilityId !== undefined && set.abilityId !== current.abilityId
            ? { abilityId: set.abilityId, abilityStatus: 'PENDING' }
            : {}),
          ...(set.itemId !== undefined && set.itemId !== current.itemId
            ? { itemId: set.itemId, itemStatus: 'PENDING' }
            : {}),
          ...(set.currentStats !== undefined ? { currentStats: set.currentStats ?? Prisma.DbNull } : {}),
          ...(set.level !== undefined ? { level: set.level } : {}),
          ...(set.hiddenEvs !== undefined ? { hiddenEvs: set.hiddenEvs ?? Prisma.DbNull } : {}),
          ...(set.ivRatings !== undefined ? { ivRatings: set.ivRatings ?? Prisma.DbNull } : {}),
          ...(set.auditLocks !== undefined ? { auditLocks: set.auditLocks ?? Prisma.DbNull } : {}),
          ...(currentEvs !== undefined
            ? { currentEvs: currentEvs ?? Prisma.DbNull, currentEvsEstimated: currentEvs ? (set.currentEvsEstimated ?? false) : false }
            : {}),
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
          await tx.rosterMove.create({
            data: { rosterPokemonId: rosterId, slot: m.slot, moveId: m.moveId, ...(m.status ? { status: m.status } : {}) },
          });
        } else if (existing.moveId !== m.moveId) {
          await tx.rosterMove.update({
            where: { id: existing.id },
            data: { moveId: m.moveId, rawName: null, status: m.status ?? 'PENDING', legal: null },
          });
        }
      }
    });
    // When all six IV ratings are known and agree on one overall potential, fill it in
    // unless the player already set one.
    if (set.ivRatings && set.potential === undefined && current.potential == null) {
      const derived = potentialFromRatings(set.ivRatings as IvRatings);
      if (derived) await prisma.rosterPokemon.update({ where: { id: rosterId }, data: { potential: derived } });
    }

    // EVs follow from the stats, so they are worked out again when any of those inputs change.
    // Typing exact EVs in the same request wins over the estimate.
    if (
      currentEvs === undefined &&
      (set.currentStats !== undefined ||
        set.level !== undefined ||
        set.hiddenEvs !== undefined ||
        set.targetNatureId !== undefined ||
        set.ivRatings !== undefined)
    ) {
      if (set.currentStats === null) {
        await prisma.rosterPokemon.update({
          where: { id: rosterId },
          data: { currentEvs: Prisma.DbNull, currentEvsEstimated: false },
        });
      } else {
        await recomputeEvsFromStats(prisma, rosterId);
      }
    }

    await syncEvStatus(prisma, rosterId);

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

/**
 * Takes a Pokémon off one page (`?role=ROSTER` or `?role=BREEDER`). It is deleted only when
 * no role is left, so one that is also a breeder stays in the breeders when removed from the roster.
 */
export async function DELETE(request: Request, ctx: RouteContext<'/api/roster/[id]'>) {
  const { id: rosterId } = await ctx.params;
  const current = await findOwned(rosterId);
  if (!current) return apiError('Not found', 404);
  const role = new URL(request.url).searchParams.get('role');
  const parsedRole = z.enum(['ROSTER', 'BREEDER']).safeParse(role);
  if (parsedRole.success) {
    await prisma.pokemonRoleAssignment.deleteMany({ where: { rosterPokemonId: rosterId, role: parsedRole.data } });
  }
  const left = await prisma.pokemonRoleAssignment.count({ where: { rosterPokemonId: rosterId } });
  if (left === 0) await prisma.rosterPokemon.delete({ where: { id: rosterId } });
  return Response.json({ ok: true, deleted: left === 0 });
}
