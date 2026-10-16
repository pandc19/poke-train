import { prisma } from '../db';
import type { GameConfig } from '../games';
import { TYPE_NAMES_ES } from '../pokemon-types';
import type { Localized } from '../translate';
import { getPokeApi } from './client';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Ref = { name: string } | null | undefined;

/** One way to evolve, as PokéAPI's evolution chain gives it. Each one names the game version it applies from. */
export type EvolutionDetail = {
  trigger: Ref;
  version_group?: Ref;
  item?: Ref;
  held_item?: Ref;
  known_move?: Ref;
  used_move?: Ref;
  known_move_type?: Ref;
  location?: Ref;
  party_species?: Ref;
  party_type?: Ref;
  trade_species?: Ref;
  required_pokemon_form?: Ref;
  evolved_pokemon_form?: Ref;
  min_level?: number | null;
  min_happiness?: number | null;
  min_affection?: number | null;
  min_beauty?: number | null;
  min_steps?: number | null;
  min_move_count?: number | null;
  min_damage_taken?: number | null;
  gender?: number | null;
  time_of_day?: string;
  relative_physical_stats?: number | null;
  needs_overworld_rain?: boolean;
  needs_multiplayer?: boolean;
  turn_upside_down?: boolean;
};

/** Item, move and species names in both languages, by PokéAPI slug. */
export type EvolutionNames = {
  item: Map<string, Localized>;
  move: Map<string, Localized>;
  species: Map<string, Localized>;
};

const REGIONAL_FORM = /-(alola|galar|hisui|paldea)(-|$)/;

const formKey = (d: EvolutionDetail) => `${d.required_pokemon_form?.name ?? ''}|${d.evolved_pokemon_form?.name ?? ''}`;
const isRegional = (d: EvolutionDetail) =>
  REGIONAL_FORM.test(d.required_pokemon_form?.name ?? '') || REGIONAL_FORM.test(d.evolved_pokemon_form?.name ?? '');
const ofRegion = (d: EvolutionDetail, region: string) =>
  [d.required_pokemon_form?.name, d.evolved_pokemon_form?.name].some((n) => n?.endsWith(`-${region}`) || n?.includes(`-${region}-`));

/**
 * The ways one step evolves in the game being played.
 *
 * A step lists its method per game version: Leafeon needed a mossy rock until Sword and Shield,
 * then a Leaf Stone. For each form of the step, the newest method not newer than the game is kept.
 * Regional forms (Galarian Slowpoke's Galarica Cuff) are kept only when that form is the one shown;
 * a step that only exists for a regional form (Paldean Wooper into Clodsire) is always kept.
 */
export function pickEvolutionDetails(
  details: EvolutionDetail[],
  /** The release order of a game version; versions after the game being played are left out. */
  orderOf: (versionGroup: string) => number,
  maxOrder: number,
  /** The regional form being shown ('galar', 'paldea'…), or '' for the usual one. */
  region: string
): EvolutionDetail[] {
  const allowed = details.filter((d) => !d.version_group || orderOf(d.version_group.name) <= maxOrder);
  const latest = new Map<string, number>();
  for (const d of allowed) {
    const order = d.version_group ? orderOf(d.version_group.name) : -1;
    latest.set(formKey(d), Math.max(latest.get(formKey(d)) ?? -Infinity, order));
  }
  const current = allowed.filter((d) => (d.version_group ? orderOf(d.version_group.name) : -1) === latest.get(formKey(d)));
  const matching = region ? current.filter((d) => ofRegion(d, region)) : [];
  if (matching.length) return matching;
  const usual = current.filter((d) => !isRegional(d));
  return usual.length ? usual : current;
}

const titleCase = (slug: string) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const both = (text: string): Localized => ({ en: text, es: text });
const named = (names: Map<string, Localized>, ref: Ref): Localized => (ref ? (names.get(ref.name) ?? both(titleCase(ref.name))) : both(''));
const typeName = (ref: Ref): Localized => ({ en: titleCase(ref?.name ?? ''), es: TYPE_NAMES_ES[ref?.name ?? ''] ?? titleCase(ref?.name ?? '') });

const TIMES: Record<string, Localized> = {
  day: { en: 'during the day', es: 'de día' },
  night: { en: 'at night', es: 'de noche' },
  dusk: { en: 'at dusk', es: 'al atardecer' },
  'full-moon': { en: 'under a full moon', es: 'con luna llena' },
};

/** One method in a few words, in both languages: "Lv. 16", "Water Stone", "Level up, high friendship, at night". */
export function describeEvolutionDetail(
  d: EvolutionDetail,
  names: EvolutionNames,
  options: { withGender: boolean; sameGame: boolean }
): Localized {
  const trigger = d.trigger?.name ?? '';
  const parts: Localized[] = [];
  const add = (en: string, es: string) => parts.push({ en, es });
  const move = named(names.move, d.used_move);
  const count = d.min_move_count ?? 0;

  switch (trigger) {
    case 'level-up':
      if (d.min_level) add(`Lv. ${d.min_level}`, `Nv. ${d.min_level}`);
      else add('Level up', 'Subir de nivel');
      break;
    case 'use-item':
      parts.push(named(names.item, d.item));
      break;
    case 'trade': {
      const held = named(names.item, d.held_item);
      const partner = named(names.species, d.trade_species);
      if (d.held_item) add(`Trade holding ${held.en}`, `Intercambio llevando ${held.es}`);
      else if (d.trade_species) add(`Trade for ${partner.en}`, `Intercambio por ${partner.es}`);
      else add('Trade', 'Intercambio');
      break;
    }
    case 'use-move':
      add(`Use ${move.en} ${count} times`, `Usar ${move.es} ${count} veces`);
      break;
    case 'agile-style-move':
    case 'strong-style-move': {
      // The styles only exist in Legends: Arceus; other games just count the uses.
      const agile = trigger === 'agile-style-move';
      add(
        `Use ${move.en} ${count} times${options.sameGame ? (agile ? ' in agile style' : ' in strong style') : ''}`,
        `Usar ${move.es} ${count} veces${options.sameGame ? (agile ? ' en estilo rápido' : ' en estilo fuerte') : ''}`
      );
      break;
    }
    case 'recoil-damage':
      add(`Lose ${d.min_damage_taken} HP from recoil`, `Perder ${d.min_damage_taken} PS por daño de retroceso`);
      break;
    case 'take-damage':
      add(`Take ${d.min_damage_taken}+ damage`, `Recibir ${d.min_damage_taken}+ de daño`);
      break;
    case 'three-critical-hits':
      add('3 critical hits in one battle', '3 golpes críticos en un combate');
      break;
    case 'gimmighoul-coins':
      add('999 Gimmighoul Coins', '999 monedas de Gimmighoul');
      break;
    case 'three-defeated-bisharp':
      add('Defeat 3 Bisharp that lead Pawniard', 'Derrotar 3 Bisharp que lideran Pawniard');
      break;
    case 'shed':
      add('Free party slot and a Poké Ball', 'Hueco libre en el equipo y una Poké Ball');
      break;
    case 'spin':
      add('Spin holding a Sweet', 'Girar llevando un Confite');
      break;
    case 'tower-of-darkness':
      add('Tower of Darkness', 'Torre de la Oscuridad');
      break;
    case 'tower-of-waters':
      add('Tower of Waters', 'Torre del Agua');
      break;
    case 'other':
      add('Special condition', 'Condición especial');
      break;
    default:
      parts.push(both(titleCase(trigger)));
  }

  if (d.min_happiness) add('high friendship', 'mucha amistad');
  if (d.min_affection) add('high affection', 'mucho afecto');
  if (d.min_beauty) add('high Beauty', 'mucha belleza');
  if (d.known_move) {
    const m = named(names.move, d.known_move);
    add(`knowing ${m.en}`, `sabiendo ${m.es}`);
  }
  if (d.known_move_type) {
    const ty = typeName(d.known_move_type);
    add(`knowing a ${ty.en} move`, `sabiendo un movimiento de tipo ${ty.es}`);
  }
  if (d.held_item && trigger !== 'trade' && trigger !== 'spin') {
    const held = named(names.item, d.held_item);
    add(`holding ${held.en}`, `llevando ${held.es}`);
  }
  if (d.time_of_day && trigger !== 'spin') parts.push(TIMES[d.time_of_day] ?? both(d.time_of_day));
  if (d.party_species) {
    const p = named(names.species, d.party_species);
    add(`with ${p.en} in the party`, `con ${p.es} en el equipo`);
  }
  if (d.party_type) {
    const ty = typeName(d.party_type);
    add(`with a ${ty.en}-type in the party`, `con un Pokémon de tipo ${ty.es} en el equipo`);
  }
  if (d.relative_physical_stats != null) {
    const sign = d.relative_physical_stats > 0 ? '>' : d.relative_physical_stats < 0 ? '<' : '=';
    add(`Atk ${sign} Def`, `Atq ${sign} Def`);
  }
  if (d.min_steps) add(`walk ${d.min_steps} steps with it following you`, `caminar ${d.min_steps} pasos con él fuera de la Poké Ball`);
  if (d.needs_overworld_rain) add('while raining', 'con lluvia');
  if (d.needs_multiplayer) add('in multiplayer', 'en multijugador');
  if (d.turn_upside_down) add('console upside down', 'consola boca abajo');
  if (d.location) {
    const place = titleCase(d.location.name);
    add(`at ${place}`, `en ${place}`);
  }
  if (options.withGender && d.gender) parts.push(both(d.gender === 1 ? '♀' : '♂'));

  return { en: parts.map((p) => p.en).join(', '), es: parts.map((p) => p.es).join(', ') };
}

/**
 * How one step evolves, ready to show: the picked methods described and joined with " / ".
 * Identical descriptions are merged (Toxtricity's two forms are both "Lv. 30"), and gender is
 * left out when both genders evolve the same way (Basculegion).
 */
export function describeEvolution(
  details: EvolutionDetail[],
  names: EvolutionNames,
  gameVersionGroups: string[]
): Localized | null {
  if (!details.length) return null;
  const genders = new Set(details.map((d) => d.gender ?? 0));
  const withGender = !(genders.has(1) && genders.has(2));
  const seen = new Map<string, Localized>();
  for (const d of details) {
    const text = describeEvolutionDetail(d, names, {
      withGender,
      sameGame: gameVersionGroups.includes(d.version_group?.name ?? ''),
    });
    if (!seen.has(text.en)) seen.set(text.en, text);
  }
  const texts = [...seen.values()];
  return { en: texts.map((x) => x.en).join(' / '), es: texts.map((x) => x.es).join(' / ') };
}

/** Each chain step as [species id, ways it evolves into it]. */
function chainSteps(node: any, out: [number, EvolutionDetail[]][] = []): [number, EvolutionDetail[]][] {
  for (const child of node?.evolves_to ?? []) {
    const id = Number(String(child.species?.url ?? '').split('/').filter(Boolean).pop());
    if (id) out.push([id, child.evolution_details ?? []]);
    chainSteps(child, out);
  }
  return out;
}

/**
 * How each member of a species' evolution family evolves (from the one before it), in the game
 * being played, by species id. The chain comes from PokéAPI through the shared cache; names
 * come from the synced tables, so items and moves read as the game calls them.
 */
export async function loadEvolutionMethods(
  speciesJson: any,
  game: GameConfig | undefined,
  /** The regional form being shown ('galar'…), or '' for the usual one. */
  region: string
): Promise<Map<number, Localized | null>> {
  const url: string | undefined = speciesJson?.evolution_chain?.url;
  const chainId = url?.split('/').filter(Boolean).pop();
  if (!chainId) return new Map();
  const chain = await getPokeApi(`evolution-chain/${chainId}`);
  const steps = chainSteps(chain.chain);
  if (!steps.length) return new Map();

  // Release order of every game version involved, so "not newer than this game" can be judged.
  const gameGroups = game ? [game.versionGroup, ...game.learnsetVersionGroups] : [];
  const groupNames = new Set([...gameGroups, ...steps.flatMap(([, ds]) => ds.map((d) => d.version_group?.name ?? ''))]);
  groupNames.delete('');
  const orders = new Map<string, number>();
  await Promise.all(
    [...groupNames].map(async (name) => {
      const vg = await getPokeApi(`version-group/${name}`).catch(() => null);
      orders.set(name, vg?.order ?? Infinity);
    })
  );
  const orderOf = (name: string) => orders.get(name) ?? Infinity;
  const maxOrder = gameGroups.length ? Math.max(...gameGroups.map(orderOf)) : Infinity;

  const picked = steps.map(([id, ds]) => [id, pickEvolutionDetails(ds, orderOf, maxOrder, region)] as const);

  const slugs = (pick: (d: EvolutionDetail) => Ref[]) => [
    ...new Set(picked.flatMap(([, ds]) => ds.flatMap(pick)).filter((r): r is { name: string } => r != null).map((r) => r.name)),
  ];
  const [items, moves, species] = await Promise.all([
    prisma.item.findMany({ where: { slug: { in: slugs((d) => [d.item, d.held_item]) } }, select: { slug: true, nameEn: true, nameEs: true } }),
    prisma.move.findMany({ where: { slug: { in: slugs((d) => [d.known_move, d.used_move]) } }, select: { slug: true, nameEn: true, nameEs: true } }),
    prisma.species.findMany({ where: { slug: { in: slugs((d) => [d.party_species, d.trade_species]) } }, select: { slug: true, nameEn: true, nameEs: true } }),
  ]);
  const byslug = (rows: { slug: string; nameEn: string; nameEs: string }[]) =>
    new Map(rows.map((r) => [r.slug, { en: r.nameEn, es: r.nameEs }]));
  const names: EvolutionNames = { item: byslug(items), move: byslug(moves), species: byslug(species) };

  return new Map(picked.map(([id, ds]) => [id, describeEvolution(ds, names, gameGroups)]));
}
