import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { prisma } from '@/lib/db';
import { sidesOf } from '@/lib/gender-sync';
import { getGame } from '@/lib/games';
import { getT } from '@/lib/i18n';
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
  if (!parsed.success) return apiError('Invalid body', 400);
  const { gameId, fileName, mapping, rows, markCaught } = parsed.data;

  const game = getGame(gameId);
  const profileId = await findProfileId(gameId);
  if (!game || !profileId) return apiError('Unknown game', 404);

  const dict = await loadDictionaries();
  const statusColumn = Object.values(mapping).includes('status');
  const t = await getT();
  const noteLabels = { status: t('Status'), natureOptions: t('Nature options'), ability: t('Ability') };
  const resolved = rows
    .map((row, i) => interpretRow(row as MappedRow, i, dict, { statusColumn, noteLabels }))
    .filter((r) => r.importable);
  if (!resolved.length) return Response.json({ error: t('No importable rows') }, { status: 422 });

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
          roles: { create: { role: 'ROSTER' } },
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
          currentEvs: r.currentEvs ?? undefined,
          evStatus: r.evStatus,
          teraType: r.teraType,
          teraStatus: r.teraStatus,
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

    // A gender in the sheet is recorded in the Pokédex too, for species that have both.
    const genders = new Map<number, { male: boolean; female: boolean }>();
    for (const r of resolved) {
      if (!r.owned) continue;
      const sides = sidesOf(r.gender);
      if (!sides.male && !sides.female) continue;
      const known = genders.get(r.species!.id) ?? { male: false, female: false };
      genders.set(r.species!.id, { male: known.male || sides.male, female: known.female || sides.female });
    }
    if (genders.size) {
      const mixed = await tx.species.findMany({
        where: { id: { in: [...genders.keys()] }, genderRate: { gt: 0, lt: 8 } },
        select: { id: true },
      });
      for (const { id: speciesId } of mixed) {
        const sides = genders.get(speciesId)!;
        const data = { ...(sides.male ? { hasMale: true } : {}), ...(sides.female ? { hasFemale: true } : {}) };
        await tx.pokedexEntry.upsert({
          where: { profileId_speciesId: { profileId, speciesId } },
          update: data,
          create: { profileId, speciesId, ...data },
        });
      }
    }
    return batch;
  });

  return Response.json({ batchId: batch.id, imported: resolved.length, skipped: rows.length - resolved.length });
}
