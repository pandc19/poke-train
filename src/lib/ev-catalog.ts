import { prisma } from './db';
import type { EvSpread } from './import/evs';
import { NATIONAL_DEX_SLUG } from './games';

export type EvSource = { id: number; nameEn: string; nameEs: string; amount: number };
export type EvSources = { stat: keyof EvSpread; species: EvSource[] };

type Candidate = EvSource & {
  yields: Partial<Record<keyof EvSpread, number>>;
  national: number;
  /** 0 for a basic Pokémon, 1 for its evolution, and so on. */
  stage: number;
};

/**
 * The best Pokémon to battle for one stat. Ones that give only that stat come
 * first, so no EVs land in a stat you do not want. Then the earliest evolution
 * stages, which are the ones met in the wild and easy to beat, and then the
 * highest yield. (With a Power item the yield hardly matters: it adds its own
 * EVs to every battle.)
 */
export function bestSources(candidates: Candidate[], stat: keyof EvSpread, limit = 4): EvSource[] {
  const total = (c: Candidate) => Object.values(c.yields).reduce((sum, v) => sum + (v ?? 0), 0);
  return candidates
    // A basic Pokémon giving 3 EVs is a Paradox or similar rarity (raids, Area Zero), not something to farm.
    .filter((c) => (c.yields[stat] ?? 0) > 0 && !(c.stage === 0 && total(c) >= 3))
    .sort((a, b) => {
      const pure = (c: Candidate) => (total(c) === (c.yields[stat] ?? 0) ? 0 : 1);
      return (
        pure(a) - pure(b) ||
        a.stage - b.stage ||
        (b.yields[stat] ?? 0) - (a.yields[stat] ?? 0) ||
        a.national - b.national
      );
    })
    .slice(0, limit)
    .map((c) => ({ id: c.id, nameEn: c.nameEn, nameEs: c.nameEs, amount: c.yields[stat] ?? 0 }));
}

/**
 * For each stat still to train, the Pokémon of this game's regional Pokédexes
 * that give those EVs. Legendaries are left out: they are not for farming.
 */
export async function loadEvSources(gameId: string, stats: (keyof EvSpread)[]): Promise<EvSources[]> {
  if (stats.length === 0) return [];
  const slots = await prisma.pokedexSlot.findMany({
    where: { pokedex: { gameId, slug: { not: NATIONAL_DEX_SLUG } }, species: { isSpecial: false } },
    select: {
      species: {
        select: {
          id: true,
          nameEn: true,
          nameEs: true,
          forms: { where: { isDefault: true }, select: { evYield: true }, take: 1 },
        },
      },
    },
  });
  const parent = new Map(
    (await prisma.species.findMany({ select: { id: true, evolvesFromId: true } })).map((x) => [x.id, x.evolvesFromId])
  );
  const stageOf = (id: number) => {
    let stage = 0;
    for (let cur = parent.get(id); cur != null && stage < 5; cur = parent.get(cur)) stage++;
    return stage;
  };
  const seen = new Set<number>();
  const candidates: Candidate[] = [];
  for (const { species } of slots) {
    if (seen.has(species.id)) continue;
    seen.add(species.id);
    const yields = species.forms[0]?.evYield as Candidate['yields'] | null | undefined;
    if (!yields) continue;
    candidates.push({
      id: species.id,
      nameEn: species.nameEn,
      nameEs: species.nameEs,
      amount: 0,
      yields,
      national: species.id,
      stage: stageOf(species.id),
    });
  }
  return stats.map((stat) => ({ stat, species: bestSources(candidates, stat) }));
}
