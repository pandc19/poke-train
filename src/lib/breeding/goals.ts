import { prisma } from '../db';
import type { GameConfig } from '../games';
import { planBreeding, type BreedingPlan } from './engine';
import { loadBreedingData, loadOwned } from './load';

type Named = { id: number; nameEn: string; nameEs: string };

export type BreedingGoalView = {
  id: string;
  species: Named;
  moves: Named[];
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE';
  plan: BreedingPlan | null;
};

/** Computes the plan against what the player owns right now. */
export async function computePlan(game: GameConfig, profileId: string, speciesId: number, moveIds: number[]) {
  const [data, owned] = await Promise.all([loadBreedingData(game, moveIds), loadOwned(profileId)]);
  return planBreeding(data, owned, speciesId, moveIds);
}

export async function loadGoals(profileId: string, ids?: string[]): Promise<BreedingGoalView[]> {
  const goals = await prisma.breedingGoal.findMany({
    where: { profileId, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { species: { select: { id: true, nameEn: true, nameEs: true } } },
  });
  const moves = await prisma.move.findMany({
    where: { id: { in: [...new Set(goals.flatMap((g) => g.moveIds))] } },
    select: { id: true, nameEn: true, nameEs: true },
  });
  const moveById = new Map(moves.map((m) => [m.id, m]));
  return goals.map((g) => ({
    id: g.id,
    species: g.species,
    moves: g.moveIds.map((id) => moveById.get(id)).filter((m): m is Named => m != null),
    status: g.status,
    plan: g.plan as BreedingPlan | null,
  }));
}
