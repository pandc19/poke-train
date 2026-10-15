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

/** Abilities that make its own moves hit harder or more reliably (only the ones that always apply). */
const ABILITY_OFFENCE: Record<
  string,
  { physical?: number; special?: number; stab?: number; weakMoves?: number; physicalAccuracy?: number }
> = {
  'huge-power': { physical: 2 },
  'pure-power': { physical: 2 },
  hustle: { physical: 1.5, physicalAccuracy: 0.8 },
  adaptability: { stab: 2 / 1.5 },
  technician: { weakMoves: 1.5 },
};

/** Abilities that attack through the opponent's immunity-giving abilities. */
const IGNORES_ABILITY = new Set(['mold-breaker', 'teravolt', 'turboblaze']);

export type OpponentInput = {
  /** Its own types. */
  types: string[];
  /** A Terastallized raid boss defends with only this type. */
  teraType: string | null;
  stats: BaseStats;
  /** PokéAPI slug of its ability, when known. */
  ability: string | null;
  /** Types of the attacking moves the player has seen it use; when present they replace its same-type guess. */
  moveTypes?: string[];
};

/** The types it defends with. */
export function defendingTypes(o: Pick<OpponentInput, 'types' | 'teraType'>): string[] {
  // A Stellar Tera type adds a bonus to attacks but leaves the defending types as they were.
  return o.teraType && o.teraType !== 'stellar' ? [o.teraType] : o.types;
}

/** The types of its attacks: the known moves, or else its own types plus the Tera type (same-type bonus). */
export function attackingTypes(o: Pick<OpponentInput, 'types' | 'teraType' | 'moveTypes'>): string[] {
  // Moves it is known to have are what it will hit with, whatever its own types are.
  if (o.moveTypes?.length) return [...new Set(o.moveTypes)];
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
  /** PokéAPI slug of its ability, when known (roster Pokémon only). */
  ability?: string | null;
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
  /** Worst hit it takes from the opponent's known moves (or its same-type attacks) (0 = immune, 4 = double weak). */
  incoming: number;
  /** Its base Speed is above the opponent's, so it moves first. */
  faster: boolean;
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
  const offence = (c.ability && ABILITY_OFFENCE[c.ability]) || {};
  const ignoresAbility = c.ability != null && IGNORES_ABILITY.has(c.ability);
  const scored = c.moves
    .map((m) => {
      const mult = ignoresAbility ? multiplier(chart, m.type, defendingTypes(opponent)) : (weakness[m.type] ?? 1);
      if (mult === 0 || m.power <= 0) return null;
      const stab = c.types.includes(m.type);
      const physical = m.damageClass === 'physical';
      const attackStat =
        (physical ? c.stats.attack : c.stats.specialAttack) * (physical ? (offence.physical ?? 1) : (offence.special ?? 1));
      const defStat = physical ? oppDef.defense : oppDef.specialDefense;
      const accuracy = ((m.accuracy ?? 100) / 100) * (physical ? (offence.physicalAccuracy ?? 1) : 1);
      const power = m.power * (m.power <= 60 ? (offence.weakMoves ?? 1) : 1);
      // The stat ratio is softened so the type matchup stays the main thing.
      const statRatio = Math.sqrt(attackStat / Math.max(defStat, 30));
      const value = power * mult * (stab ? 1.5 * (offence.stab ?? 1) : 1) * accuracy * statRatio;
      return { m, mult, stab, value };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.value - a.value || Number(b.m.known) - Number(a.m.known));
  if (!scored.length) return null;

  const best = scored[0];
  // Its own ability can make it immune to (or resist) a type of the opponent's attacks.
  const defenceFx = (c.ability && ABILITY_TYPE_EFFECTS[c.ability]) || {};
  const incoming = Math.max(
    ...attackingTypes(opponent).map((t) => multiplier(chart, t, c.types) * (defenceFx[t] ?? 1))
  );
  const bulk = (c.stats.hp * (c.stats.defense + c.stats.specialDefense)) / 2 / 5000;
  const faster = c.stats.speed > opponent.stats.speed;
  // Moving first is worth a lot when the hit it takes is not the end of it.
  const score = best.value * survivability(incoming) * (0.7 + Math.min(bulk, 1.2) * 0.3) * (faster ? 1.15 : 1);

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
    faster,
    alternatives,
  };
}

/**
 * Safe first: 0 = hits it super effectively and resists (or is immune to) its attacks, 1 = hits it
 * super effectively and takes neutral damage, 2 and 3 = the same with neutral hits, 4 = the rest
 * (weak to it, or its best hit is resisted). Lower is better.
 */
export function safetyTier(c: Pick<Counter, 'incoming' | 'move'>): number {
  const resists = c.incoming <= 0.5;
  const neutralOrBetter = c.incoming <= 1;
  const superEffective = c.move.multiplier >= 2;
  const notResisted = c.move.multiplier >= 1;
  if (superEffective && resists) return 0;
  if (superEffective && neutralOrBetter) return 1;
  if (notResisted && resists) return 2;
  if (notResisted && neutralOrBetter) return 3;
  return 4;
}

/** Best counters first: by safety tier, then score. Keeps one entry per species. */
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
  return [...bySpecies.values()]
    .sort((a, b) => safetyTier(a) - safetyTier(b) || b.score - a.score)
    .slice(0, limit);
}
