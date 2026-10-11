import { prisma } from './db';

/**
 * Deterministic move-legality check against synced PokéAPI learnsets --
 * no LLM involved. A move is legal for a species when any of its forms, or
 * any form of a pre-evolution, learns it in one of the game's version groups
 * (pre-evolution moves and egg moves carry over on evolution).
 *
 * @returns for each requested species id, the set of legal move ids among `moveIds`.
 */
export async function legalMoves(
  speciesIds: number[],
  moveIds: number[],
  versionGroups: string[]
): Promise<Map<number, Set<number>>> {
  const result = new Map<number, Set<number>>(speciesIds.map((id) => [id, new Set()]));
  if (!speciesIds.length || !moveIds.length) return result;

  // species -> itself plus all ancestors
  const all = await prisma.species.findMany({ select: { id: true, evolvesFromId: true } });
  const parent = new Map(all.map((s) => [s.id, s.evolvesFromId]));
  const lineage = new Map<number, number[]>();
  for (const id of speciesIds) {
    const chain: number[] = [];
    for (let cur: number | null | undefined = id; cur != null && !chain.includes(cur); cur = parent.get(cur)) {
      chain.push(cur);
    }
    lineage.set(id, chain);
  }

  const rows = await prisma.learnset.findMany({
    where: {
      versionGroup: { in: versionGroups },
      moveId: { in: moveIds },
      form: { speciesId: { in: [...new Set([...lineage.values()].flat())] } },
    },
    select: { moveId: true, form: { select: { speciesId: true } } },
    distinct: ['moveId', 'formId'],
  });
  const learnedBy = new Map<number, Set<number>>();
  for (const r of rows) {
    if (!learnedBy.has(r.form.speciesId)) learnedBy.set(r.form.speciesId, new Set());
    learnedBy.get(r.form.speciesId)!.add(r.moveId);
  }
  for (const [id, chain] of lineage) {
    for (const ancestor of chain) {
      for (const moveId of learnedBy.get(ancestor) ?? []) result.get(id)!.add(moveId);
    }
  }
  return result;
}
