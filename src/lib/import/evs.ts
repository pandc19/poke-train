import { normalizeKey } from './text';

export type EvSpread = {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
};

const STAT_ALIASES: Record<string, keyof EvSpread> = {
  hp: 'hp', ps: 'hp', vida: 'hp', salud: 'hp',
  atk: 'attack', attack: 'attack', atq: 'attack', ataque: 'attack', at: 'attack',
  def: 'defense', defense: 'defense', defensa: 'defense',
  spa: 'specialAttack', spatk: 'specialAttack', specialattack: 'specialAttack', sataque: 'specialAttack',
  ataqueespecial: 'specialAttack', atesp: 'specialAttack', atqesp: 'specialAttack', ae: 'specialAttack',
  spd: 'specialDefense', spdef: 'specialDefense', specialdefense: 'specialDefense',
  defensaespecial: 'specialDefense', defesp: 'specialDefense', de: 'specialDefense',
  spe: 'speed', speed: 'speed', vel: 'speed', velocidad: 'speed',
};

/**
 * Parses spreads such as "252 Atk / 4 SpD / 252 Spe" or
 * "252 Ataque, 252 Velocidad, 4 PS". Returns null when nothing is recognised
 * or the spread is impossible (more than 252 in a stat or 510 in total).
 */
export function parseEvs(raw: string): EvSpread | null {
  const spread: EvSpread = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
  let found = 0;
  for (const part of raw.split(/[/,;\n]/)) {
    const m = part.trim().match(/^(\d{1,3})\s*(?:evs?\s*)?(.+)$/i) ?? null;
    const reversed = m ? null : part.trim().match(/^(.+?)\s*[:=]?\s*(\d{1,3})$/);
    const value = Number(m?.[1] ?? reversed?.[2]);
    const stat = STAT_ALIASES[normalizeKey(m?.[2] ?? reversed?.[1] ?? '')];
    if (!stat || !Number.isFinite(value)) continue;
    spread[stat] = value;
    found++;
  }
  if (!found) return null;
  const values = Object.values(spread);
  if (values.some((v) => v > 252) || values.reduce((a, b) => a + b, 0) > 510) return null;
  return spread;
}

const STAT_LABELS: [keyof EvSpread, string][] = [
  ['hp', 'HP'],
  ['attack', 'Atk'],
  ['defense', 'Def'],
  ['specialAttack', 'SpA'],
  ['specialDefense', 'SpD'],
  ['speed', 'Spe'],
];

/** How many EVs a spread still needs to reach a target. Stats already at or past it count as 0. */
export function evGap(target: EvSpread, current: EvSpread | null): EvSpread {
  const have = current ?? { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
  const left = (key: keyof EvSpread) => Math.max(0, target[key] - have[key]);
  return {
    hp: left('hp'),
    attack: left('attack'),
    defense: left('defense'),
    specialAttack: left('specialAttack'),
    specialDefense: left('specialDefense'),
    speed: left('speed'),
  };
}

export const evTotal = (evs: EvSpread): number => Object.values(evs).reduce((sum, v) => sum + v, 0);

/** "252 Atk / 4 SpD / 252 Spe" */
export function formatEvs(evs: EvSpread): string {
  return STAT_LABELS.filter(([key]) => evs[key] > 0)
    .map(([key, label]) => `${evs[key]} ${label}`)
    .join(' / ');
}
