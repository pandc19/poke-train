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
  { physical?: number; special?: number; adaptability?: boolean; weakMoves?: number; physicalAccuracy?: number }
> = {
  'huge-power': { physical: 2 },
  'pure-power': { physical: 2 },
  hustle: { physical: 1.5, physicalAccuracy: 0.8 },
  adaptability: { adaptability: true },
  technician: { weakMoves: 1.5 },
};

/** Abilities that attack through the opponent's immunity-giving abilities. */
const IGNORES_ABILITY = new Set(['mold-breaker', 'teravolt', 'turboblaze']);

/** The ability changes how it does in a matchup (so it is worth naming). */
export function abilityMatters(slug: string | null | undefined): boolean {
  return slug != null && (slug in ABILITY_TYPE_EFFECTS || slug in ABILITY_OFFENCE || IGNORES_ABILITY.has(slug));
}

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
  /** Abilities it can have, tried in turn when `ability` is not set (game suggestions). */
  abilityOptions?: string[];
  /** The Tera type it would Terastallize into; null = it does not (or it is not known). */
  teraType?: string | null;
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
  /** How hard its best move hits (power, matchup, same-type bonus, stats), defence left out. */
  offence: number;
  /** The move to use, with what it does to the opponent. */
  move: { id: number; multiplier: number; stab: boolean; known: boolean };
  /** The Tera type it was judged with (its own, or the best one for a game suggestion); null = none. */
  teraType: string | null;
  /** The ability it was judged with (its own, or the best one for a game suggestion); null = none. */
  ability: string | null;
  /**
   * Worst hit it takes from the opponent's known moves (or its same-type attacks) once Terastallized,
   * or on its own types when it has no Tera type (0 = immune, 4 = double weak).
   */
  incoming: number;
  /** The same before it Terastallizes, on its own types. */
  incomingBase: number;
  /** Its base Speed is above the opponent's, so it moves first. */
  faster: boolean;
  /** Other moves of different types that also work, best first, for coverage. */
  alternatives: { id: number; multiplier: number; stab: boolean; known: boolean }[];
};

/** A Tera type that changes its types (Stellar keeps them). */
function teraOf(c: Pick<Candidate, 'teraType'>): string | null {
  return c.teraType && c.teraType !== 'stellar' ? c.teraType : null;
}

/**
 * Same-type bonus once Terastallized: its own types and its Tera type both count, and a Tera type
 * that is one of its own types doubles instead (Adaptability: 2, or 2.25 with that Tera).
 */
function stabFactor(c: Candidate, moveType: string, adaptability: boolean): number {
  const own = c.types.includes(moveType);
  const tera = teraOf(c) === moveType;
  if (own && tera) return adaptability ? 2.25 : 2;
  if (own || tera) return adaptability ? 2 : 1.5;
  return 1;
}

/**
 * The least a move has to do to be worth using. A Terastallized opponent (a raid boss) has to be
 * hit super effectively; otherwise a neutral hit will do.
 */
export function minimumMultiplier(opponent: Pick<OpponentInput, 'teraType'>): number {
  return opponent.teraType ? 2 : 1;
}

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
 * type multiplier, times the same-type bonus (Tera included), times (softened) the attacking stat
 * it would use over the opponent's matching defence. Only moves that hit hard enough count
 * (see minimumMultiplier). Defence is the worst hit it takes from the opponent's attacks, mostly
 * once Terastallized and partly before (a raid starts without it). Returns null when it has no move
 * that works.
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
  const minimum = minimumMultiplier(opponent);
  const scored = c.moves
    .map((m) => {
      const mult = ignoresAbility ? multiplier(chart, m.type, defendingTypes(opponent)) : (weakness[m.type] ?? 1);
      if (mult < minimum || m.power <= 0) return null;
      const stab = stabFactor(c, m.type, offence.adaptability ?? false);
      const physical = m.damageClass === 'physical';
      const attackStat =
        (physical ? c.stats.attack : c.stats.specialAttack) * (physical ? (offence.physical ?? 1) : (offence.special ?? 1));
      const defStat = physical ? oppDef.defense : oppDef.specialDefense;
      const accuracy = ((m.accuracy ?? 100) / 100) * (physical ? (offence.physicalAccuracy ?? 1) : 1);
      const power = m.power * (m.power <= 60 ? (offence.weakMoves ?? 1) : 1);
      // The stat ratio is softened so the type matchup stays the main thing.
      const statRatio = Math.sqrt(attackStat / Math.max(defStat, 30));
      const value = power * mult * stab * accuracy * statRatio;
      return { m, mult, stab: stab > 1, value };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.value - a.value || Number(b.m.known) - Number(a.m.known));
  if (!scored.length) return null;

  const best = scored[0];
  // Its own ability can make it immune to (or resist) a type of the opponent's attacks.
  const defenceFx = (c.ability && ABILITY_TYPE_EFFECTS[c.ability]) || {};
  const worstHit = (types: string[]) =>
    Math.max(...attackingTypes(opponent).map((t) => multiplier(chart, t, types) * (defenceFx[t] ?? 1)));
  const tera = teraOf(c);
  const incomingBase = worstHit(c.types);
  const incoming = tera ? worstHit([tera]) : incomingBase;
  // Most of the fight is after Terastallizing, but it has to last until then.
  const defence = tera ? survivability(incoming) * 0.65 + survivability(incomingBase) * 0.35 : survivability(incoming);
  const bulk = (c.stats.hp * (c.stats.defense + c.stats.specialDefense)) / 2 / 5000;
  const faster = c.stats.speed > opponent.stats.speed;
  // Moving first is worth a lot when the hit it takes is not the end of it.
  const score = best.value * defence * (0.7 + Math.min(bulk, 1.2) * 0.3) * (faster ? 1.15 : 1);

  // Other moves that also work, of other types, for coverage.
  const seen = new Set([best.m.type]);
  const alternatives: Counter['alternatives'] = [];
  for (const s of scored) {
    if (seen.has(s.m.type)) continue;
    seen.add(s.m.type);
    alternatives.push({ id: s.m.id, multiplier: s.mult, stab: s.stab, known: s.m.known });
    if (alternatives.length === 2) break;
  }
  return {
    ref: c.ref,
    formId: c.formId,
    speciesId: c.speciesId,
    score,
    offence: best.value,
    move: { id: best.m.id, multiplier: best.mult, stab: best.stab, known: best.m.known },
    teraType: c.teraType ?? null,
    ability: c.ability ?? null,
    incoming,
    incomingBase,
    faster,
    alternatives,
  };
}

/**
 * Safe first, because a Pokémon that cannot take its hits will not get to attack: 0-1 = resists
 * (or is immune to) every attack, 2-3 = takes them neutrally, 4-5 = is weak to one. Within each,
 * hitting super effectively comes before a neutral hit. Lower is better.
 */
export function safetyTier(c: Pick<Counter, 'incoming' | 'move'>): number {
  const defence = c.incoming <= 0.5 ? 0 : c.incoming <= 1 ? 1 : 2;
  return defence * 2 + (c.move.multiplier >= 2 ? 0 : 1);
}

const better = (a: Counter, b: Counter) => safetyTier(a) - safetyTier(b) || b.score - a.score;

/** Hitting for less than this share of the strongest one is too weak to lead with, however safe. */
const WEAK_OFFENCE = 0.5;

/**
 * Best counters first: by safety tier, then score. Keeps one entry per species. With `teraTypes`,
 * a candidate without its own Tera type is tried with each, and one without an ability with each
 * of its `abilityOptions`; it keeps the combination that does best.
 */
export function rankCounters(
  chart: TypeChart,
  opponent: OpponentInput,
  weakness: Record<string, number>,
  candidates: Candidate[],
  limit: number,
  teraTypes?: string[]
): Counter[] {
  const bySpecies = new Map<number, Counter>();
  for (const c of candidates) {
    const withAbility =
      c.ability == null && c.abilityOptions?.length ? c.abilityOptions.map((ability) => ({ ...c, ability })) : [c];
    const tries =
      teraTypes && c.teraType == null
        ? withAbility.flatMap((a) => teraTypes.map((teraType) => ({ ...a, teraType })))
        : withAbility;
    for (const t of tries) {
      const r = scoreCandidate(chart, opponent, weakness, t);
      if (!r) continue;
      const prev = bySpecies.get(r.speciesId);
      if (!prev || better(r, prev) < 0) bySpecies.set(r.speciesId, r);
    }
  }
  // A safe Pokémon that barely scratches it drops one defence step, behind the ones that hit hard.
  const all = [...bySpecies.values()];
  const strongest = Math.max(0, ...all.map((c) => c.offence));
  const tier = (c: Counter) => safetyTier(c) + (c.offence < strongest * WEAK_OFFENCE ? 2 : 0);
  return all.sort((a, b) => tier(a) - tier(b) || b.score - a.score).slice(0, limit);
}
