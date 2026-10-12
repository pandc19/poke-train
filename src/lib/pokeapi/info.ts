import { prisma } from '../db';
import type { GameConfig } from '../games';
import { getPokeApi } from './client';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PokemonInfo = {
  id: number;
  nameEn: string;
  nameEs: string;
  genus: { es: string | null; en: string | null };
  flavor: { es: string | null; en: string | null };
  types: string[];
  heightM: number | null;
  weightKg: number | null;
  artwork: string | null;
  abilities: { nameEn: string; nameEs: string; isHidden: boolean }[];
  stats: { key: string; value: number }[];
  eggGroups: string[];
  /** Eighths female; -1 = genderless. */
  genderRate: number;
  captureRate: number | null;
  baseHappiness: number | null;
  isBaby: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  generation: string | null;
  /** The whole evolution family, each with the stage it sits at and what it comes from. */
  evolutions: { id: number; nameEn: string; nameEs: string; spriteUrl: string | null; stage: number; from: number | null }[];
  /** Where it sits in the game's own Pokédexes, when a game was given. */
  dexEntries: { dex: string; number: number }[];
};

type FlavorEntry = { flavor_text: string; language: { name: string }; version?: { name: string } };

/**
 * Picks the Pokédex text for a language, preferring the given game versions
 * (most preferred first) and otherwise the most recent entry.
 */
export function pickFlavor(entries: FlavorEntry[], language: string, preferVersions: string[] = []): string | null {
  const own = entries.filter((e) => e.language.name === language);
  if (!own.length) return null;
  const preferred = preferVersions.map((v) => own.find((e) => e.version?.name === v)).find((e) => e != null);
  const entry = preferred ?? own[own.length - 1];
  return entry.flavor_text.replace(/[\n\f\r]+/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

/** Orders an evolution family into stages: the base form is stage 0, its evolutions stage 1, and so on. */
export function evolutionStages(
  species: { id: number; evolvesFromId: number | null }[],
  id: number
): { id: number; stage: number; from: number | null }[] {
  const parent = new Map(species.map((s) => [s.id, s.evolvesFromId]));
  let root = id;
  for (let guard = 0; guard < 10; guard++) {
    const up = parent.get(root);
    if (up == null) break;
    root = up;
  }
  const children = new Map<number, number[]>();
  for (const s of species) {
    if (s.evolvesFromId != null) {
      if (!children.has(s.evolvesFromId)) children.set(s.evolvesFromId, []);
      children.get(s.evolvesFromId)!.push(s.id);
    }
  }
  const out: { id: number; stage: number; from: number | null }[] = [{ id: root, stage: 0, from: null }];
  for (let i = 0; i < out.length; i++) {
    for (const child of children.get(out[i].id) ?? []) out.push({ id: child, stage: out[i].stage + 1, from: out[i].id });
  }
  return out;
}

const STAT_KEYS = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const;

/**
 * Everything the Pokédex info dialog shows for one species. Types, stats,
 * abilities, egg groups and evolutions come from the synced PokéAPI tables;
 * the description, genus, size and capture data come from PokéAPI itself
 * (via the shared cache). Nothing here depends on your roster.
 */
export async function loadPokemonInfo(speciesId: number, game?: GameConfig): Promise<PokemonInfo | null> {
  const species = await prisma.species.findUnique({
    where: { id: speciesId },
    select: {
      id: true,
      nameEn: true,
      nameEs: true,
      eggGroups: true,
      genderRate: true,
      isBaby: true,
      forms: { where: { isDefault: true }, select: { id: true, types: true, baseStats: true, spriteUrl: true }, take: 1 },
    },
  });
  if (!species) return null;
  const form = species.forms[0];

  const [speciesJson, pokemonJson, family, slots] = await Promise.all([
    getPokeApi(`pokemon-species/${speciesId}`),
    form ? getPokeApi(`pokemon/${form.id}`) : Promise.resolve(null),
    prisma.species.findMany({
      select: {
        id: true,
        evolvesFromId: true,
        nameEn: true,
        nameEs: true,
        forms: { where: { isDefault: true }, select: { spriteUrl: true }, take: 1 },
      },
    }),
    game
      ? prisma.pokedexSlot.findMany({
          where: { speciesId, pokedex: { gameId: game.id } },
          select: { entryNumber: true, pokedex: { select: { slug: true, name: true, sortOrder: true } } },
        })
      : Promise.resolve([]),
  ]);

  const abilitySlugs: { slug: string; isHidden: boolean }[] = (pokemonJson?.abilities ?? []).map((a: any) => ({
    slug: a.ability.name,
    isHidden: a.is_hidden,
  }));
  const abilityRows = abilitySlugs.length
    ? await prisma.ability.findMany({
        where: { slug: { in: abilitySlugs.map((a) => a.slug) } },
        select: { slug: true, nameEn: true, nameEs: true },
      })
    : [];
  const abilityBySlug = new Map(abilityRows.map((a) => [a.slug, a]));

  // Games name their Pokédex text by version; Violet's own entry comes first.
  const prefer = game?.id === 'violet' ? ['violet', 'scarlet'] : [];
  const flavors: FlavorEntry[] = speciesJson.flavor_text_entries ?? [];
  const genera: { genus: string; language: { name: string } }[] = speciesJson.genera ?? [];
  const genus = (lang: string) => genera.find((g) => g.language.name === lang)?.genus ?? null;

  const byId = new Map(family.map((s) => [s.id, s]));
  const stats = (form?.baseStats ?? {}) as Record<string, number>;
  const artwork =
    pokemonJson?.sprites?.other?.['official-artwork']?.front_default ?? form?.spriteUrl ?? null;

  return {
    id: species.id,
    nameEn: species.nameEn,
    nameEs: species.nameEs,
    genus: { es: genus('es'), en: genus('en') },
    flavor: { es: pickFlavor(flavors, 'es', prefer), en: pickFlavor(flavors, 'en', prefer) },
    types: form?.types ?? [],
    heightM: pokemonJson ? pokemonJson.height / 10 : null,
    weightKg: pokemonJson ? pokemonJson.weight / 10 : null,
    artwork,
    abilities: abilitySlugs.map((a) => {
      const row = abilityBySlug.get(a.slug);
      return { nameEn: row?.nameEn ?? a.slug, nameEs: row?.nameEs ?? a.slug, isHidden: a.isHidden };
    }),
    stats: STAT_KEYS.map((key) => ({ key, value: stats[key] ?? 0 })),
    eggGroups: species.eggGroups,
    genderRate: species.genderRate,
    captureRate: speciesJson.capture_rate ?? null,
    baseHappiness: speciesJson.base_happiness ?? null,
    isBaby: species.isBaby,
    isLegendary: Boolean(speciesJson.is_legendary),
    isMythical: Boolean(speciesJson.is_mythical),
    generation: speciesJson.generation?.name ?? null,
    evolutions: evolutionStages(family, speciesId).map((e) => ({
      ...e,
      nameEn: byId.get(e.id)?.nameEn ?? String(e.id),
      nameEs: byId.get(e.id)?.nameEs ?? String(e.id),
      spriteUrl: byId.get(e.id)?.forms[0]?.spriteUrl ?? null,
    })),
    dexEntries: slots
      .sort((a, b) => a.pokedex.sortOrder - b.pokedex.sortOrder)
      .map((s) => ({ dex: s.pokedex.name, number: s.entryNumber })),
  };
}
