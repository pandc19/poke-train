import { evGap, evTotal, formatEvs, type EvSpread } from './import/evs';

const KEYS: (keyof EvSpread)[] = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];
const MAX_STAT = 252;
const MAX_TOTAL = 510;

/**
 * Makes the spread the model proposed a spread the game allows: at most 252 in
 * a stat and 510 in all. Where EVs are hard to change, `keepCurrent` also never
 * goes below what the Pokémon already has, so the plan only adds to it.
 */
export function legalPlan(proposed: EvSpread, current: EvSpread | null, keepCurrent: boolean): EvSpread {
  const floor = (key: keyof EvSpread) => (keepCurrent ? Math.min(MAX_STAT, current?.[key] ?? 0) : 0);
  const plan = { ...proposed };
  for (const key of KEYS) {
    plan[key] = Math.max(floor(key), Math.min(MAX_STAT, Math.max(0, Math.round(proposed[key]))));
  }
  // Over 510: take the surplus back from the stat with the most EVs above its floor.
  while (evTotal(plan) > MAX_TOTAL) {
    const key = KEYS.reduce((best, k) => (plan[k] - floor(k) > plan[best] - floor(best) ? k : best), KEYS[0]);
    if (plan[key] - floor(key) <= 0) break;
    plan[key] -= Math.min(plan[key] - floor(key), evTotal(plan) - MAX_TOTAL);
  }
  return plan;
}

/** The texts the audit shows for an EV plan, worked out here instead of trusted to the model. */
export function describePlan(plan: EvSpread, current: EvSpread | null, nothing: string) {
  const gap = evGap(plan, current);
  return {
    spread: formatEvs(plan) || nothing,
    toTrain: evTotal(gap) > 0 ? formatEvs(gap) : nothing,
  };
}
