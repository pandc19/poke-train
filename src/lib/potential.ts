/**
 * The Judge ("Juez") rating of a Pokémon's overall potential, best last.
 * Games that have a Judge set `features.judge`. The labels are English; if
 * your game words them differently, this is the one place to change them.
 */
export const POTENTIAL_LEVELS = [
  { value: 'NO_GOOD', label: 'No good', labelEs: 'Nada bueno', className: 'border-line text-muted' },
  { value: 'DECENT', label: 'Decent', labelEs: 'Aceptable', className: 'border-line text-ink' },
  { value: 'PRETTY_GOOD', label: 'Pretty good', labelEs: 'Bastante bueno', className: 'border-sky-500/50 bg-sky-500/10 text-sky-300' },
  { value: 'VERY_GOOD', label: 'Very good', labelEs: 'Muy bueno', className: 'border-done/50 bg-done/10 text-done' },
  { value: 'FANTASTIC', label: 'Fantastic', labelEs: 'Fantástico', className: 'border-star/50 bg-star/10 text-star' },
  { value: 'BEST', label: 'Best', labelEs: 'El mejor', className: 'border-pink-400/60 bg-pink-400/10 text-pink-300' },
] as const;

export type PotentialValue = (typeof POTENTIAL_LEVELS)[number]['value'];

export const potentialLevel = (value: string | null | undefined) =>
  POTENTIAL_LEVELS.find((l) => l.value === value) ?? null;
