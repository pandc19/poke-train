import { prisma } from '../db';
import type { GameConfig } from '../games';
import { IV_STATS, planBreeding, type BreedingPlan, type IvStat } from './engine';
import { planIvs, type IvPlan } from './ivs';
import { loadBreedingData, loadOwned } from './load';
import { findMatch } from './match';

type Named = { id: number; nameEn: string; nameEs: string };

export type BreedingGoalView = {
  id: string;
  species: Named;
  moves: Named[];
  /** What the offspring should be like, besides its moves. */
  ivTargets: IvStat[];
  nature: Named | null;
  hiddenAbility: boolean;
  /** The species' hidden ability, named, when the plan asks for it. */
  hiddenAbilityName: Named | null;
  /** A Pokémon you already have that matches the whole plan, so the plan can be deleted. */
  match: { id: string; label: string | null } | null;
  /** The best parents for those wishes among what you have, or null when none were asked for. */
  ivs: IvPlan | null;
  /** Computed from the current roster and Pokédex every time it is loaded. */
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
  const natureIds = [...new Set(goals.flatMap((g) => (g.natureId != null ? [g.natureId] : [])))];
  const [moves, natures, data, owned] = await Promise.all([
    prisma.move.findMany({ where: { id: { in: allMoveIds } }, select: { id: true, nameEn: true, nameEs: true } }),
    prisma.nature.findMany({ where: { id: { in: natureIds } }, select: { id: true, nameEn: true, nameEs: true } }),
    loadBreedingData(game, allMoveIds),
    loadOwned(profileId),
  ]);
  // The hidden ability of each species a plan asks it for.
  const hiddenWanted = [...new Set(goals.filter((g) => g.hiddenAbility).map((g) => g.speciesId))];
  const hiddenRows = hiddenWanted.length
    ? await prisma.formAbility.findMany({
        where: { isHidden: true, form: { speciesId: { in: hiddenWanted }, isDefault: true } },
        select: { form: { select: { speciesId: true } }, ability: { select: { id: true, nameEn: true, nameEs: true } } },
      })
    : [];
  const hiddenBySpecies = new Map(hiddenRows.map((r) => [r.form.speciesId, r.ability]));
  const moveById = new Map(moves.map((m) => [m.id, m]));
  const natureById = new Map(natures.map((n) => [n.id, n]));

  const views = goals.map((g): BreedingGoalView => {
    const ivTargets = g.ivTargets.filter((s): s is IvStat => (IV_STATS as readonly string[]).includes(s));
    const wantsMore = ivTargets.length > 0 || g.natureId != null || g.hiddenAbility;
    const ivs = wantsMore
      ? planIvs(data, owned, g.speciesId, { ivTargets, natureId: g.natureId, hiddenAbility: g.hiddenAbility })
      : null;
    const plan = planBreeding(data, owned, g.speciesId, g.moveIds);
    // Something you already have that is what the plan is for: the species, its nature, 31 in every wanted
    // IV, the moves, and the hidden ability when asked.
    const found = findMatch(owned.roster, { speciesId: g.speciesId, natureId: g.natureId, ivTargets, moveIds: g.moveIds, hiddenAbility: g.hiddenAbility });
    return {
      id: g.id,
      species: g.species,
      moves: g.moveIds.map((id) => moveById.get(id)).filter((m): m is Named => m != null),
      ivTargets,
      nature: g.natureId != null ? (natureById.get(g.natureId) ?? null) : null,
      hiddenAbility: g.hiddenAbility,
      hiddenAbilityName: g.hiddenAbility ? (hiddenBySpecies.get(g.speciesId) ?? null) : null,
      match: found ? { id: found.id!, label: found.label ?? null } : null,
      ivs,
      plan,
    };
  });
  return views;
}
