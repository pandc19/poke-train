/**
 * The Judge's ("Juez") overall verdict on a Pokémon's potential, which comes
 * from its IVs. There are four levels, lowest first. In the Spanish games the
 * Judge says "potencial aceptable", "superior a la media", "notable" and
 * "extraordinario". The Judge also rates each stat separately; this app keeps
 * only the overall one.
 */
export const POTENTIAL_LEVELS = [
  { value: 'DECENT', label: 'Decent', labelEs: 'Aceptable', className: 'border-line text-ink' },
  { value: 'ABOVE_AVERAGE', label: 'Above average', labelEs: 'Superior a la media', className: 'border-sky-500/50 bg-sky-500/10 text-sky-300' },
  { value: 'RELATIVELY_SUPERIOR', label: 'Relatively superior', labelEs: 'Notable', className: 'border-done/50 bg-done/10 text-done' },
  { value: 'OUTSTANDING', label: 'Outstanding', labelEs: 'Extraordinario', className: 'border-star/50 bg-star/10 text-star' },
] as const;

export type PotentialValue = (typeof POTENTIAL_LEVELS)[number]['value'];

export const potentialLevel = (value: string | null | undefined) =>
  POTENTIAL_LEVELS.find((l) => l.value === value) ?? null;
