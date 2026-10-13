/**
 * Works out what to use against an opponent from type matchups, base stats and move data only.
 * Pure functions: the database reads live in load.ts.
 */

/** Non-neutral pairs only, keyed `${attacker}>${defender}`; anything missing is 1. */
export type TypeChart = Map<string, number>;

export function chartFrom(rows: { attacker: string; defender: string; multiplier: number }[]): TypeChart {
  return new Map(rows.map((r) => [`${r.attacker}>${r.defender}`, r.multiplier]));
}

/** How much a move of `attack` type does to something with these types. */
export function multiplier(chart: TypeChart, attack: string, defenderTypes: string[]): number {
  return defenderTypes.reduce((m, d) => m * (chart.get(`${attack}>${d}`) ?? 1), 1);
}

export type BaseStats = {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
};

/**
 * Abilities that change how a type hits: 0 = immune, 0.5 = halved. A small fixed table because
 * PokéAPI only has prose for what an ability does.
 */
export const ABILITY_TYPE_EFFECTS: Record<string, Record<string, number>> = {
  levitate: { ground: 0 },
  'earth-eater': { ground: 0 },
  'flash-fire': { fire: 0 },
  'well-baked-body': { fire: 0 },
  'water-absorb': { water: 0 },
  'storm-drain': { water: 0 },
  'dry-skin': { water: 0 },
  'volt-absorb': { electric: 0 },
  'lightning-rod': { electric: 0 },
  'motor-drive': { electric: 0 },
  'sap-sipper': { grass: 0 },
  'thick-fat': { fire: 0.5, ice: 0.5 },
  heatproof: { fire: 0.5 },
  'water-bubble': { fire: 0.5 },
  'purifying-salt': { ghost: 0.5 },
};

export type OpponentInput = {
  /** Its own types. */
  types: string[];
  /** A Terastallized raid boss defends with only this type. */
  teraType: string | null;
  stats: BaseStats;
  /** PokéAPI slug of its ability, when known. */
  ability: string | null;
};

/** The types it defends with. */
export function defendingTypes(o: Pick<OpponentInput, 'types' | 'teraType'>): string[] {
  // A Stellar Tera type adds a bonus to attacks but leaves the defending types as they were.
  return o.teraType && o.teraType !== 'stellar' ? [o.teraType] : o.types;
}

/** The types its own attacks get the same-type bonus on: its own types plus the Tera type. */
export function attackingTypes(o: Pick<OpponentInput, 'types' | 'teraType'>): string[] {
  return o.teraType && o.teraType !== 'stellar' && !o.types.includes(o.teraType) ? [...o.types, o.teraType] : o.types;
}

/** Multiplier of each attacking type against the opponent, ability included. */
export function weaknessTable(chart: TypeChart, o: OpponentInput, allTypes: string[]): Record<string, number> {
  const defending = defendingTypes(o);
  const abilityFx = (o.ability && ABILITY_TYPE_EFFECTS[o.ability]) || {};
  return Object.fromEntries(
    allTypes.map((type) => [type, multiplier(chart, type, defending) * (abilityFx[type] ?? 1)])
  );
}

export type Candidate = {
  /** Lets the caller find its own row again (roster entry index...). */
  ref?: number;
  formId: number;
  speciesId: number;
  types: string[];
  stats: BaseStats;
  moves: CandidateMove[];
};

export type CandidateMove = {
  id: number;
  type: string;
  damageClass: 'physical' | 'special';
  power: number;
  accuracy: number | null;
  /** The Pokémon knows it right now (roster build), as opposed to being able to learn it. */
  known: boolean;
};

export type Counter = {
  ref?: number;
  formId: number;
  speciesId: number;
  score: number;
  /** The move to use, with what it does to the opponent. */
  move: { id: number; multiplier: number; stab: boolean; known: boolean };
  /** Worst hit it takes from the opponent's same-type attacks (0 = immune, 4 = double weak). */
  incoming: number;
  /** Other good moves of different types, best first, for coverage. */
  alternatives: { id: number; multiplier: number; stab: boolean; known: boolean }[];
};

/** How much a hit the Pokémon takes counts against it: from immune (a bonus) to 4x (a big penalty). */
function survivability(incoming: number): number {
  if (incoming === 0) return 1.8;
  if (incoming <= 0.25) return 1.5;
  if (incoming <= 0.5) return 1.3;
  if (incoming <= 1) return 1;
  if (incoming <= 2) return 0.65;
  return 0.4;
}

/**
 * Scores a Pokémon against the opponent. Offence is its best damaging move: power, times the
 * type multiplier, times 1.5 for same-type, times (softened) the attacking stat it would use over
 * the opponent's matching defence. Defence is the worst hit it takes from the opponent's same-type
 * attacks. Returns null when it has no damaging move that does anything.
 */
export function scoreCandidate(
  chart: TypeChart,
  opponent: OpponentInput,
  weakness: Record<string, number>,
  c: Candidate
): Counter | null {
  const oppDef = opponent.stats;
  const scored = c.moves
    .map((m) => {
      const mult = weakness[m.type] ?? 1;
      if (mult === 0 || m.power <= 0) return null;
      const stab = c.types.includes(m.type);
      const physical = m.damageClass === 'physical';
      const attackStat = physical ? c.stats.attack : c.stats.specialAttack;
      const defStat = physical ? oppDef.defense : oppDef.specialDefense;
      const accuracy = (m.accuracy ?? 100) / 100;
      // The stat ratio is softened so the type matchup stays the main thing.
      const statRatio = Math.sqrt(attackStat / Math.max(defStat, 30));
      const value = m.power * mult * (stab ? 1.5 : 1) * accuracy * statRatio;
      return { m, mult, stab, value };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.value - a.value || Number(b.m.known) - Number(a.m.known));
  if (!scored.length) return null;

  const best = scored[0];
  const incoming = Math.max(...attackingTypes(opponent).map((t) => multiplier(chart, t, c.types)));
  const bulk = (c.stats.hp * (c.stats.defense + c.stats.specialDefense)) / 2 / 5000;
  const score = best.value * survivability(incoming) * (0.7 + Math.min(bulk, 1.2) * 0.3);

  // Moves of other types that also hit well, for coverage.
  const seen = new Set([best.m.type]);
  const alternatives: Counter['alternatives'] = [];
  for (const s of scored) {
    if (seen.has(s.m.type) || s.mult < 1) continue;
    seen.add(s.m.type);
    alternatives.push({ id: s.m.id, multiplier: s.mult, stab: s.stab, known: s.m.known });
    if (alternatives.length === 2) break;
  }
  return {
    ref: c.ref,
    formId: c.formId,
    speciesId: c.speciesId,
    score,
    move: { id: best.m.id, multiplier: best.mult, stab: best.stab, known: best.m.known },
    incoming,
    alternatives,
  };
}

/** Best counters first. Keeps one entry per species. */
export function rankCounters(
  chart: TypeChart,
  opponent: OpponentInput,
  weakness: Record<string, number>,
  candidates: Candidate[],
  limit: number
): Counter[] {
  const bySpecies = new Map<number, Counter>();
  for (const c of candidates) {
    const r = scoreCandidate(chart, opponent, weakness, c);
    if (!r) continue;
    const prev = bySpecies.get(r.speciesId);
    if (!prev || r.score > prev.score) bySpecies.set(r.speciesId, r);
  }
  return [...bySpecies.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
