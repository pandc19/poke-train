/**
 * Breeding and matchmaking engine. Pure: it works on plain data so it can be
 * unit tested without a database (see load.ts for the Prisma side).
 *
 * Rules modelled (Generation 6 onwards):
 *  - Two Pokémon can breed when they share an egg group, are of opposite
 *    gender, and neither is in the "no-eggs" group. Ditto breeds with
 *    anything that can breed, including genderless Pokémon.
 *  - The egg is the mother's species (or the non-Ditto parent's), at its
 *    base stage.
 *  - The egg knows an egg move if either parent knows it.
 *  - Scarlet/Violet only: a Pokémon holding a Mirror Herb with a free move
 *    slot copies its egg moves from any party member at a picnic, no egg needed.
 */

export type SpeciesInfo = {
  id: number;
  nameEn: string;
  nameEs: string;
  eggGroups: string[];
  /** Eighths that are female; -1 = genderless. */
  genderRate: number;
  evolvesFromId: number | null;
  /** Obtainable in the game being planned for. */
  available: boolean;
};

export type LearnWay = { method: string; level: number };

export type BreedingData = {
  species: Map<number, SpeciesInfo>;
  /** speciesId -> moveId -> how that exact species learns it in this game. */
  learns: Map<number, Map<number, LearnWay[]>>;
  mirrorHerb: boolean;
};

export type OwnedPokemon = {
  speciesId: number;
  gender: 'MALE' | 'FEMALE' | 'GENDERLESS' | 'UNKNOWN';
  moveIds: number[];
};

export type Owned = {
  /** Trained roster Pokémon the player has (gender and moves known). */
  roster: OwnedPokemon[];
  /** Species marked caught in any Pokédex (gender and moves unknown). */
  caughtSpeciesIds: Set<number>;
};

export type SpeciesRef = { id: number; nameEn: string; nameEs: string };

/** How the player stands with respect to a species a step needs. */
export type Have = 'ready' | 'caught' | 'missing';

export type Step =
  | { action: 'obtain'; species: SpeciesRef; have: Have; gender?: 'male' | 'female' }
  | { action: 'teach'; species: SpeciesRef; method: string; level: number }
  | { action: 'breed'; father: SpeciesRef; mother: SpeciesRef; offspring: SpeciesRef }
  | { action: 'picnic'; from: SpeciesRef; to: SpeciesRef };

export type MoveOption = {
  kind: 'mirror-herb' | 'breed' | 'chain';
  /** True when the player already owns a Pokémon that knows the move. */
  ready: boolean;
  steps: Step[];
};

export type MovePlan = {
  moveId: number;
  /**
   * natural: the target learns it without breeding.
   * egg: needs a parent (or picnic partner) that knows it.
   * illegal: cannot have it in this game at all.
   */
  kind: 'natural' | 'egg' | 'illegal';
  natural?: { species: SpeciesRef; method: string; level: number };
  options: MoveOption[];
};

export type ParentPlan = {
  /** Base-stage species the egg hatches as. */
  hatchesAs: SpeciesRef;
  canBreed: boolean;
  /** Why not, when canBreed is false. */
  reason?: 'no-eggs' | 'unknown-species';
  /** Needs Ditto: genderless, or a male-only line. */
  needsDitto: boolean;
  haveMother: boolean;
  haveDitto: boolean;
  steps: Step[];
};

export type BreedingPlan = { target: SpeciesRef; parents: ParentPlan; moves: MovePlan[] };

export const DITTO_ID = 132;
const NO_EGGS = 'no-eggs';
const MAX_CHAIN_DEPTH = 3;
const MAX_OPTIONS = 3;

const ref = (s: SpeciesInfo): SpeciesRef => ({ id: s.id, nameEn: s.nameEn, nameEs: s.nameEs });

/** The species itself followed by its pre-evolutions, base stage last. */
export function lineage(data: BreedingData, speciesId: number): SpeciesInfo[] {
  const chain: SpeciesInfo[] = [];
  for (let cur = data.species.get(speciesId); cur && !chain.includes(cur); ) {
    chain.push(cur);
    cur = cur.evolvesFromId != null ? data.species.get(cur.evolvesFromId) : undefined;
  }
  return chain;
}

const baseOf = (data: BreedingData, speciesId: number) => lineage(data, speciesId).at(-1);

const canBreedAtAll = (s: SpeciesInfo) => s.eggGroups.length > 0 && !s.eggGroups.includes(NO_EGGS) && s.id !== DITTO_ID;
const canBeMale = (s: SpeciesInfo) => s.genderRate >= 0 && s.genderRate < 8;
const canBeFemale = (s: SpeciesInfo) => s.genderRate > 0;
const shareGroup = (a: SpeciesInfo, b: SpeciesInfo) => a.eggGroups.some((g) => b.eggGroups.includes(g));

/** Ways a species' line learns a move, split into egg and everything else. */
function waysFor(data: BreedingData, speciesId: number, moveId: number) {
  let natural: { species: SpeciesInfo; way: LearnWay } | null = null;
  let egg = false;
  for (const s of lineage(data, speciesId)) {
    for (const way of data.learns.get(s.id)?.get(moveId) ?? []) {
      if (way.method === 'egg') {
        egg = true;
        continue;
      }
      // Prefer level-up (lowest level) over TMs and tutors: it costs nothing.
      const better =
        !natural ||
        (way.method === 'level-up' && (natural.way.method !== 'level-up' || way.level < natural.way.level));
      if (better) natural = { species: s, way };
    }
  }
  return { natural, egg };
}

function haveOf(owned: Owned, data: BreedingData, speciesId: number, knowsMove?: number): Have {
  // Any stage of the same family counts: a Golem can father what a Geodude can.
  const family = new Set(familyIds(data, speciesId));
  const inRoster = owned.roster.filter((p) => family.has(p.speciesId));
  if (knowsMove != null ? inRoster.some((p) => p.moveIds.includes(knowsMove)) : inRoster.length > 0) return 'ready';
  if (inRoster.length > 0 || [...family].some((id) => owned.caughtSpeciesIds.has(id))) return 'caught';
  return 'missing';
}

const childrenIndex = new WeakMap<BreedingData, Map<number, number[]>>();

function familyIds(data: BreedingData, speciesId: number): number[] {
  let children = childrenIndex.get(data);
  if (!children) {
    children = new Map();
    for (const s of data.species.values()) {
      if (s.evolvesFromId == null) continue;
      if (!children.has(s.evolvesFromId)) children.set(s.evolvesFromId, []);
      children.get(s.evolvesFromId)!.push(s.id);
    }
    childrenIndex.set(data, children);
  }
  const base = baseOf(data, speciesId);
  if (!base) return [speciesId];
  const ids = [base.id];
  // Walk down the evolution tree from the base stage.
  for (let i = 0; i < ids.length; i++) {
    for (const child of children.get(ids[i]) ?? []) {
      if (!ids.includes(child)) ids.push(child);
    }
  }
  return ids;
}

/** The stage of a family that can actually breed (baby Pokémon cannot; their evolutions can). */
function breederOf(data: BreedingData, speciesId: number): SpeciesInfo | null {
  const family = familyIds(data, speciesId).map((id) => data.species.get(id)!);
  const self = data.species.get(speciesId);
  if (self && canBreedAtAll(self)) return self;
  return family.find(canBreedAtAll) ?? null;
}

/** A species that can teach the move to an egg of `mother`'s line by being the father. */
type Donor = { species: SpeciesInfo; way: LearnWay; have: Have };

/**
 * Fathers for `child`: available, able to be male, sharing an egg group, and
 * learning the move without breeding. One per evolution family (the stage
 * that learns it most cheaply), best first.
 */
function directDonors(data: BreedingData, owned: Owned, child: SpeciesInfo, moveId: number): Donor[] {
  const byFamily = new Map<number, Donor>();
  for (const s of data.species.values()) {
    if (!s.available || !canBreedAtAll(s) || !canBeMale(s) || !shareGroup(s, child)) continue;
    const way = pickNatural(data.learns.get(s.id)?.get(moveId));
    if (!way) continue;
    const family = baseOf(data, s.id)?.id ?? s.id;
    const donor: Donor = { species: s, way, have: haveOf(owned, data, s.id, moveId) };
    const existing = byFamily.get(family);
    if (!existing || rank(donor) < rank(existing)) byFamily.set(family, donor);
  }
  return [...byFamily.values()].sort((a, b) => rank(a) - rank(b) || a.species.id - b.species.id);
}

function pickNatural(ways: LearnWay[] | undefined): LearnWay | null {
  const natural = (ways ?? []).filter((w) => w.method !== 'egg');
  if (!natural.length) return null;
  return natural.sort((a, b) => methodCost(a) - methodCost(b))[0];
}

const methodCost = (w: LearnWay) => (w.method === 'level-up' ? w.level : w.method === 'machine' ? 200 : 300);
const HAVE_RANK: Record<Have, number> = { ready: 0, caught: 1, missing: 2 };
const rank = (d: Donor) => HAVE_RANK[d.have] * 1000 + methodCost(d.way);

const donorSteps = (d: Donor): Step[] => [
  { action: 'obtain', species: ref(d.species), have: d.have, gender: 'male' },
  ...(d.have === 'ready' ? [] : [{ action: 'teach' as const, species: ref(d.species), method: d.way.method, level: d.way.level }]),
];

/**
 * Shortest multi-generation path when no father learns the move directly:
 * a donor passes it to an intermediate species (as that species' egg move),
 * whose male offspring passes it on, until the target's line is reached.
 */
function chainPath(data: BreedingData, owned: Owned, target: SpeciesInfo, moveId: number): Step[] | null {
  type Node = { species: SpeciesInfo; next: Node | null };
  let frontier: Node[] = [{ species: target, next: null }];
  const seen = new Set([baseOf(data, target.id)?.id ?? target.id]);

  for (let depth = 0; depth < MAX_CHAIN_DEPTH && frontier.length; depth++) {
    const nextFrontier: Node[] = [];
    for (const node of frontier) {
      if (depth > 0) {
        const donor = directDonors(data, owned, node.species, moveId)[0];
        if (donor) {
          const steps: Step[] = [...donorSteps(donor)];
          let father = donor.species;
          for (let cur: Node | null = node; cur; cur = cur.next) {
            const hatches = baseOf(data, cur.species.id) ?? cur.species;
            steps.push({ action: 'breed', father: ref(father), mother: ref(cur.species), offspring: ref(hatches) });
            father = hatches;
          }
          return steps;
        }
      }
      // Intermediates: species that get the move as an egg move and can father `node`.
      for (const s of data.species.values()) {
        if (!s.available || !canBreedAtAll(s) || !canBeMale(s) || !canBeFemale(s) || !shareGroup(s, node.species)) continue;
        const family = baseOf(data, s.id)?.id ?? s.id;
        if (seen.has(family) || !waysFor(data, s.id, moveId).egg) continue;
        seen.add(family);
        nextFrontier.push({ species: s, next: node });
      }
    }
    frontier = nextFrontier;
  }
  return null;
}

function planMove(data: BreedingData, owned: Owned, target: SpeciesInfo, moveId: number, mother: SpeciesInfo | null): MovePlan {
  const { natural, egg } = waysFor(data, target.id, moveId);
  if (natural) {
    return {
      moveId,
      kind: 'natural',
      natural: { species: ref(natural.species), method: natural.way.method, level: natural.way.level },
      options: [],
    };
  }
  if (!egg) return { moveId, kind: 'illegal', options: [] };

  const options: MoveOption[] = [];
  const hatches = baseOf(data, target.id) ?? target;

  if (data.mirrorHerb) {
    // Any owned Pokémon that knows the move works, whatever its species.
    const knower = owned.roster.find((p) => p.moveIds.includes(moveId) && data.species.has(p.speciesId));
    if (knower) {
      options.push({
        kind: 'mirror-herb',
        ready: true,
        steps: [{ action: 'picnic', from: ref(data.species.get(knower.speciesId)!), to: ref(target) }],
      });
    }
  }

  if (mother) {
    for (const donor of directDonors(data, owned, mother, moveId).slice(0, MAX_OPTIONS)) {
      options.push({
        kind: 'breed',
        ready: donor.have === 'ready',
        steps: [...donorSteps(donor), { action: 'breed', father: ref(donor.species), mother: ref(mother), offspring: ref(hatches) }],
      });
    }
    if (!options.some((o) => o.kind === 'breed')) {
      const chain = chainPath(data, owned, mother, moveId);
      if (chain) options.push({ kind: 'chain', ready: false, steps: chain });
    }
  }

  if (data.mirrorHerb && !options.some((o) => o.kind === 'mirror-herb')) {
    // No owned knower: the cheapest species to catch and level up, of any egg group.
    const anyDonor = [...data.species.values()]
      .filter((s) => s.available)
      .map((s) => ({ species: s, way: pickNatural(data.learns.get(s.id)?.get(moveId)) }))
      .filter((d): d is { species: SpeciesInfo; way: LearnWay } => d.way != null)
      .map((d) => ({ ...d, have: haveOf(owned, data, d.species.id, moveId) }))
      .sort((a, b) => rank(a) - rank(b) || a.species.id - b.species.id)[0];
    if (anyDonor) {
      options.push({
        kind: 'mirror-herb',
        ready: false,
        steps: [
          { action: 'obtain', species: ref(anyDonor.species), have: anyDonor.have },
          { action: 'teach', species: ref(anyDonor.species), method: anyDonor.way.method, level: anyDonor.way.level },
          { action: 'picnic', from: ref(anyDonor.species), to: ref(target) },
        ],
      });
    }
  }

  // Things the player can do right now come first.
  options.sort((a, b) => Number(b.ready) - Number(a.ready));
  return { moveId, kind: 'egg', options };
}

function planParents(data: BreedingData, owned: Owned, target: SpeciesInfo): ParentPlan {
  const hatches = baseOf(data, target.id) ?? target;
  const family = new Set(familyIds(data, target.id));
  const haveDitto = owned.caughtSpeciesIds.has(DITTO_ID) || owned.roster.some((p) => p.speciesId === DITTO_ID);
  const ditto = data.species.get(DITTO_ID);

  const breeder = breederOf(data, target.id);
  if (!breeder) {
    return { hatchesAs: ref(hatches), canBreed: false, reason: 'no-eggs', needsDitto: false, haveMother: false, haveDitto, steps: [] };
  }
  const needsDitto = !canBeFemale(breeder);
  const inRoster = owned.roster.filter((p) => family.has(p.speciesId));
  const haveFamily = inRoster.length > 0 || [...family].some((id) => owned.caughtSpeciesIds.has(id));
  const haveFemale = inRoster.some((p) => p.gender === 'FEMALE');
  const haveMother = needsDitto ? haveFamily : haveFemale;

  const steps: Step[] = [];
  if (needsDitto) {
    steps.push({ action: 'obtain', species: ref(breeder), have: haveFamily ? 'ready' : 'missing' });
    if (ditto) steps.push({ action: 'obtain', species: ref(ditto), have: haveDitto ? 'ready' : 'missing' });
  } else {
    // A caught family member of unknown gender might already be female.
    steps.push({
      action: 'obtain',
      species: ref(breeder),
      have: haveFemale ? 'ready' : haveFamily ? 'caught' : 'missing',
      gender: 'female',
    });
  }
  return { hatchesAs: ref(hatches), canBreed: true, needsDitto, haveMother, haveDitto, steps };
}

/** Builds the full plan for breeding `targetId` with the wanted moves. */
export function planBreeding(data: BreedingData, owned: Owned, targetId: number, moveIds: number[]): BreedingPlan | null {
  const target = data.species.get(targetId);
  if (!target) return null;
  const parents = planParents(data, owned, target);
  return {
    target: ref(target),
    parents,
    moves: moveIds.map((moveId) => planMove(data, owned, target, moveId, breederOf(data, target.id))),
  };
}
