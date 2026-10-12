/**
 * The Judge's ("Juez") overall verdict on a Pokémon's potential, which comes
 * from its IVs, lowest first. In the Spanish games the Judge says "potencial
 * aceptable", "superior a la media", "notable" and "extraordinario". The Judge
 * also rates each stat separately; this app keeps only the overall one.
 *
 * `ivs` is the per-stat average IV that verdict stands for (the overall rating
 * covers a range of the six IVs added together, out of 186): 0-90 decent,
 * 91-120 above average, 121-150 relatively superior, 151-186 outstanding.
 * `assumed` is the middle of that range.
 */
export const POTENTIAL_LEVELS = [
  {
    value: 'DECENT', label: 'Decent', labelEs: 'Aceptable',
    ivs: { low: 0, high: 15, assumed: 8 },
    className: 'border-line text-ink',
  },
  {
    value: 'ABOVE_AVERAGE', label: 'Above average', labelEs: 'Superior a la media',
    ivs: { low: 15, high: 20, assumed: 18 },
    className: 'border-sky-500/50 bg-sky-500/10 text-sky-300',
  },
  {
    value: 'RELATIVELY_SUPERIOR', label: 'Relatively superior', labelEs: 'Notable',
    ivs: { low: 20, high: 25, assumed: 23 },
    className: 'border-done/50 bg-done/10 text-done',
  },
  {
    value: 'OUTSTANDING', label: 'Outstanding', labelEs: 'Extraordinario',
    ivs: { low: 25, high: 31, assumed: 28 },
    className: 'border-star/50 bg-star/10 text-star',
  },
] as const;

export type PotentialValue = (typeof POTENTIAL_LEVELS)[number]['value'];

export const potentialLevel = (value: string | null | undefined) =>
  POTENTIAL_LEVELS.find((l) => l.value === value) ?? null;

/** The IV the maths should assume per stat, with the range it could really be in. */
export type IvAssumption = {
  assumed: number;
  low: number;
  high: number;
  /** False when no potential is set, so perfect IVs are assumed. */
  fromPotential: boolean;
};

export function ivAssumption(value: string | null | undefined): IvAssumption {
  const level = potentialLevel(value);
  if (!level) return { assumed: 31, low: 31, high: 31, fromPotential: false };
  return { ...level.ivs, fromPotential: true };
}
