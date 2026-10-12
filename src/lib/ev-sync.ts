import type { Prisma, PrismaClient } from '@prisma/client';
import { estimateEvRange } from './ev-estimate';
import { ivAssumption } from './potential';
import type { IvRatings } from './iv-ratings';
import type { EvSpread } from './import/evs';
import { planReached } from './ev-plan';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Works the current EVs out from the stats the player entered (the numbers
 * on the game's blue graph), its level and its nature, and saves them. The
 * game only draws EVs as a shape, so the stats are the number you can read.
 * Does nothing when no stats are recorded.
 */
export async function recomputeEvsFromStats(db: Db, rosterId: string): Promise<void> {
  const row = await db.rosterPokemon.findUnique({
    where: { id: rosterId },
    select: {
      currentStats: true,
      level: true,
      speciesId: true,
      formId: true,
      currentNatureId: true,
      targetNatureId: true,
      potential: true,
      ivRatings: true,
    },
  });
  if (!row?.currentStats) return;

  const form = row.formId
    ? await db.form.findUnique({ where: { id: row.formId }, select: { baseStats: true } })
    : await db.form.findFirst({ where: { speciesId: row.speciesId, isDefault: true }, select: { baseStats: true } });
  if (!form) return;

  // The nature it really has; failing that, the one planned for it.
  const natureId = row.currentNatureId ?? row.targetNatureId;
  const nature = natureId
    ? await db.nature.findUnique({ where: { id: natureId }, select: { increased: true, decreased: true } })
    : null;

  // The fewest EVs that fit: judged stats are held to their IV band, the rest assume perfect IVs.
  const { estimate: evs } = estimateEvRange({
    stats: row.currentStats as unknown as EvSpread,
    level: row.level,
    baseStats: form.baseStats as unknown as EvSpread,
    nature,
    ivsLow: ivAssumption(row.potential).low,
    ratings: row.ivRatings as IvRatings | null,
  });
  await db.rosterPokemon.update({
    where: { id: rosterId },
    data: { currentEvs: evs, currentEvsEstimated: true },
  });
}

/**
 * The EV task follows the training: done once the current EVs reach the
 * planned spread, pending again if they fall short (for example after a reset).
 * Does nothing without a plan or without known current EVs.
 */
export async function syncEvStatus(db: Db, rosterId: string): Promise<void> {
  const row = await db.rosterPokemon.findUnique({
    where: { id: rosterId },
    select: { evs: true, currentEvs: true, evStatus: true },
  });
  if (!row?.evs || !row.currentEvs) return;
  const status = planReached(row.evs as unknown as EvSpread, row.currentEvs as unknown as EvSpread) ? 'DONE' : 'PENDING';
  if (status !== row.evStatus) {
    await db.rosterPokemon.update({ where: { id: rosterId }, data: { evStatus: status } });
  }
}
