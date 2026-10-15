import { z } from 'zod';
import { apiError } from '../api-error';
import { prisma } from '../db';
import type { GameConfig } from '../games';
import { TYPE_SLUGS } from '../pokemon-types';

const fields = {
  speciesId: z.number().int().positive(),
  formId: z.number().int().positive().nullable(),
  kind: z.enum(['RAID', 'STANDARD']),
  teraType: z.enum(TYPE_SLUGS as [string, ...string[]]).nullable(),
  stars: z.number().int().min(1).max(7).nullable(),
  abilityId: z.number().int().positive().nullable(),
  moveIds: z.array(z.number().int().positive()).max(4),
  label: z.string().trim().max(80).nullable(),
  notes: z.string().trim().max(1000).nullable(),
};

export const CreateBody = z.object({ gameId: z.string() }).extend({
  ...fields,
  formId: fields.formId.optional(),
  kind: fields.kind.optional(),
  teraType: fields.teraType.optional(),
  stars: fields.stars.optional(),
  abilityId: fields.abilityId.optional(),
  moveIds: fields.moveIds.optional(),
  label: fields.label.optional(),
  notes: fields.notes.optional(),
});

export const UpdateBody = z.object({ ...fields, archived: z.boolean(), defeated: z.boolean(), bestRosterId: z.uuid().nullable() }).partial();

export type OpponentData = {
  speciesId: number;
  formId: number | null;
  kind: 'RAID' | 'STANDARD';
  teraType: string | null;
  stars: number | null;
  abilityId: number | null;
  moveIds: number[];
  label: string | null;
  notes: string | null;
};

/**
 * Checks the combination makes sense for the game (the form belongs to the species, the ability to
 * the form, Tera and stars only where the game has them) and cleans what does not apply.
 * Returns the error text, or the data to save.
 */
export async function checkOpponent(
  game: GameConfig,
  data: OpponentData
): Promise<{ error: 'species' | 'form' | 'ability' | 'move' } | { data: OpponentData }> {
  const species = await prisma.species.findUnique({ where: { id: data.speciesId }, select: { id: true } });
  if (!species) return { error: 'species' };

  const form = data.formId
    ? await prisma.form.findUnique({ where: { id: data.formId }, select: { speciesId: true } })
    : null;
  if (data.formId && form?.speciesId !== data.speciesId) return { error: 'form' };

  if (data.abilityId) {
    const where = data.formId ? { id: data.formId } : { speciesId: data.speciesId, isDefault: true };
    const has = await prisma.formAbility.findFirst({
      where: { abilityId: data.abilityId, form: where },
      select: { abilityId: true },
    });
    if (!has) return { error: 'ability' };
  }

  const moveIds = [...new Set(data.moveIds)];
  if (moveIds.length) {
    const found = await prisma.move.count({ where: { id: { in: moveIds } } });
    if (found !== moveIds.length) return { error: 'move' };
  }

  return {
    data: {
      ...data,
      moveIds,
      teraType: game.features.teraType ? data.teraType : null,
      kind: game.features.raids ? data.kind : 'STANDARD',
      stars: game.features.raids && data.kind === 'RAID' ? data.stars : null,
      label: data.label || null,
      notes: data.notes || null,
    },
  };
}

/** The 400 response for a combination `checkOpponent` rejected. */
export function opponentError(code: 'species' | 'form' | 'ability' | 'move'): Promise<Response> {
  if (code === 'species') return apiError('Unknown Pokémon', 400);
  if (code === 'form') return apiError('That form does not belong to that Pokémon', 400);
  if (code === 'move') return apiError('Unknown move', 400);
  return apiError('That ability does not belong to that Pokémon', 400);
}
