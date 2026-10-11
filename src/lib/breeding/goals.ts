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
  /** Always computed fresh from the current roster and Pokédex, never stored. */
  plan: BreedingPlan | null;
};

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
  const [moves, data, owned] = await Promise.all([
    prisma.move.findMany({ where: { id: { in: allMoveIds } }, select: { id: true, nameEn: true, nameEs: true } }),
    loadBreedingData(game, allMoveIds),
    loadOwned(profileId),
  ]);
  const moveById = new Map(moves.map((m) => [m.id, m]));

  return goals.map((g) => ({
    id: g.id,
    species: g.species,
    moves: g.moveIds.map((id) => moveById.get(id)).filter((m): m is Named => m != null),
    status: g.status,
    plan: planBreeding(data, owned, g.speciesId, g.moveIds),
  }));
}
