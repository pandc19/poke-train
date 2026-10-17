import type { IvStat, OwnedPokemon } from './engine';

/**
 * A Pokémon the player already has that is what a plan is for: the species, its nature, 31 in every wanted
 * IV, the wanted moves, and the hidden ability when the plan asks for it. A Pokédex entry is not one:
 * nothing is known about it.
 */
export function findMatch(
  owned: OwnedPokemon[],
  goal: { speciesId: number; natureId: number | null; ivTargets: IvStat[]; moveIds: number[]; hiddenAbility: boolean }
): OwnedPokemon | undefined {
  return owned.find(
    (o) =>
      (o.source === 'roster' || o.source === 'breeder') &&
      o.id != null &&
      o.speciesId === goal.speciesId &&
      (goal.natureId == null || o.natureId === goal.natureId) &&
      goal.ivTargets.every((s) => o.ivs?.[s] === 'perfect') &&
      goal.moveIds.every((m) => o.moveIds.includes(m)) &&
      (!goal.hiddenAbility || o.hiddenAbility === true)
  );
}
