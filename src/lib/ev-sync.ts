import type { Prisma, PrismaClient } from '@prisma/client';
import { estimateEvs } from './ev-estimate';
import type { EvSpread } from './import/evs';

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

  const evs = estimateEvs({
    stats: row.currentStats as unknown as EvSpread,
    level: row.level,
    baseStats: form.baseStats as unknown as EvSpread,
    nature,
  });
  await db.rosterPokemon.update({
    where: { id: rosterId },
    data: { currentEvs: evs, currentEvsEstimated: true },
  });
}
