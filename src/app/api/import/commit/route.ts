import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getGame } from '@/lib/games';
import { FIELDS, type MappedRow } from '@/lib/import/fields';
import { loadDictionaries } from '@/lib/import/dictionaries';
import { interpretRow } from '@/lib/import/interpret';
import { legalMoves } from '@/lib/legality';
import { findProfileId } from '@/lib/profile';

const fieldKeys = FIELDS.map((f) => f.key) as [string, ...string[]];
const Body = z.object({
  gameId: z.string(),
  fileName: z.string().max(300),
  mapping: z.record(z.string(), z.enum(fieldKeys)),
  rows: z.array(z.partialRecord(z.enum(fieldKeys), z.string().max(2000))).min(1).max(2000),
  markCaught: z.boolean().default(true),
});

/**
 * Imports mapped rows as roster Pokémon in one transaction. Rows are
 * re-resolved on the server (the preview is advisory), move legality is
 * checked against the game's learnsets, and owned Pokémon can be marked
 * caught in the Pokédex in the same step.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const { gameId, fileName, mapping, rows, markCaught } = parsed.data;

  const game = getGame(gameId);
  const profileId = await findProfileId(gameId);
  if (!game || !profileId) return Response.json({ error: 'Unknown game' }, { status: 404 });

  const dict = await loadDictionaries();
  const resolved = rows.map((row, i) => interpretRow(row as MappedRow, i, dict)).filter((r) => r.importable);
  if (!resolved.length) return Response.json({ error: 'No importable rows' }, { status: 422 });

  const legal = await legalMoves(
    [...new Set(resolved.map((r) => r.species!.id))],
    [...new Set(resolved.flatMap((r) => r.moves.map((m) => m.match?.id).filter((id) => id != null)))],
    game.learnsetVersionGroups
  );

  const batch = await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: { profileId, fileName, mapping, rowCount: resolved.length },
    });
    const last = await tx.rosterPokemon.aggregate({ where: { profileId }, _max: { sortOrder: true } });
    let sortOrder = last._max.sortOrder ?? 0;

    for (const r of resolved) {
      await tx.rosterPokemon.create({
        data: {
          profileId,
          importBatchId: batch.id,
          sortOrder: ++sortOrder,
          speciesId: r.species!.id,
          baseSpeciesId: r.baseSpecies?.id,
          nickname: r.nickname,
          gender: r.gender,
          origin: r.origin,
          owned: r.owned,
          targetNatureId: r.targetNature?.id,
          currentNatureId: r.currentNature?.id,
          natureStatus: r.natureStatus,
          abilityId: r.ability?.id,
          abilityStatus: r.abilityStatus,
          itemId: r.item?.id,
          itemNote: r.itemNote,
          itemStatus: r.itemStatus,
          evs: r.evs ?? undefined,
          evStatus: r.evStatus,
          teraType: r.teraType,
          notes: r.notes,
          moves: {
            create: r.moves.map((m) => ({
              slot: m.slot,
              moveId: m.match?.id,
              rawName: m.match ? null : m.raw,
              status: m.status,
              legal: m.match ? legal.get(r.species!.id)!.has(m.match.id) : null,
            })),
          },
        },
      });
    }

    if (markCaught) {
      const speciesIds = new Set<number>();
      for (const r of resolved) {
        if (!r.owned) continue;
        speciesIds.add(r.species!.id);
        if (r.baseSpecies) speciesIds.add(r.baseSpecies.id);
      }
      await tx.pokedexEntry.createMany({
        data: [...speciesIds].map((speciesId) => ({ profileId, speciesId })),
        skipDuplicates: true,
      });
    }
    return batch;
  });

  return Response.json({ batchId: batch.id, imported: resolved.length, skipped: rows.length - resolved.length });
}
