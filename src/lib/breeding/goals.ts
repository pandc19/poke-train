import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import type { GameConfig } from '../games';
import { IV_STATS, planBreeding, type BreedingPlan, type IvStat } from './engine';
import { planIvs, type IvPlan } from './ivs';
import { loadBreedingData, loadOwned } from './load';

type Named = { id: number; nameEn: string; nameEs: string };

export type BreedingGoalView = {
  id: string;
  species: Named;
  moves: Named[];
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE';
  /** What the offspring should be like, besides its moves. */
  ivTargets: IvStat[];
  nature: Named | null;
  hiddenAbility: boolean;
  /** The best parents for those wishes among what you have, or null when none were asked for. */
  ivs: IvPlan | null;
  /** Computed from the current roster and Pokédex, except while the plan is done (see `locked`). */
  plan: BreedingPlan | null;
  /** The plan is done: ivs and plan are what they were when it was marked, whatever you change since. */
  locked: boolean;
};

type Frozen = { ivs: IvPlan | null; plan: BreedingPlan | null };

/**
 * Loads goals with plans computed against what the player owns right now,
 * so registering a Pokémon in the Pokédex updates every plan without a
 * manual "recheck". Game data and ownership are loaded once for all goals.
 */
export async function loadGoals(game: GameConfig, profileId: string, ids?: string[]): Promise<BreedingGoalView[]> {
  const goals = await prisma.breedingGoal.findMany({
    where: { profileId, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { species: { select: { id: true, nameEn: true, nameEs: true } } },
  });
  if (!goals.length) return [];

  const allMoveIds = [...new Set(goals.flatMap((g) => g.moveIds))];
  const natureIds = [...new Set(goals.flatMap((g) => (g.natureId != null ? [g.natureId] : [])))];
  const [moves, natures, data, owned] = await Promise.all([
    prisma.move.findMany({ where: { id: { in: allMoveIds } }, select: { id: true, nameEn: true, nameEs: true } }),
    prisma.nature.findMany({ where: { id: { in: natureIds } }, select: { id: true, nameEn: true, nameEs: true } }),
    loadBreedingData(game, allMoveIds),
    loadOwned(profileId),
  ]);
  const moveById = new Map(moves.map((m) => [m.id, m]));
  const natureById = new Map(natures.map((n) => [n.id, n]));

  const toFreeze: { id: string; frozen: Frozen }[] = [];
  const views = goals.map((g): BreedingGoalView => {
    const ivTargets = g.ivTargets.filter((s): s is IvStat => (IV_STATS as readonly string[]).includes(s));
    const wantsMore = ivTargets.length > 0 || g.natureId != null || g.hiddenAbility;
    const saved = g.status === 'DONE' ? (g.frozen as Frozen | null) : null;
    const live: Frozen = saved ?? {
      ivs: wantsMore
        ? planIvs(data, owned, g.speciesId, { ivTargets, natureId: g.natureId, hiddenAbility: g.hiddenAbility })
        : null,
      plan: planBreeding(data, owned, g.speciesId, g.moveIds),
    };
    // A plan done before plans could be locked is locked the first time it is loaded.
    if (g.status === 'DONE' && !saved) toFreeze.push({ id: g.id, frozen: live });
    return {
      id: g.id,
      species: g.species,
      moves: g.moveIds.map((id) => moveById.get(id)).filter((m): m is Named => m != null),
      status: g.status,
      ivTargets,
      nature: g.natureId != null ? (natureById.get(g.natureId) ?? null) : null,
      hiddenAbility: g.hiddenAbility,
      ivs: live.ivs,
      plan: live.plan,
      locked: g.status === 'DONE',
    };
  });
  await Promise.all(
    toFreeze.map((f) =>
      prisma.breedingGoal.update({ where: { id: f.id }, data: { frozen: f.frozen as unknown as Prisma.InputJsonValue } })
    )
  );
  return views;
}
