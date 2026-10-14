import { prisma } from '../db';
import type { Lang } from '../i18n';

type Dictionary = { map: Map<string, string>; re: RegExp };
let loading: Promise<Dictionary> | null = null;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every game name that differs between English and Spanish (moves, items, abilities, natures, Pokémon), loaded
 * once per server run. It is what the game itself calls them in Spanish, taken from the synced game data.
 */
function load(): Promise<Dictionary> {
  loading ??= (async () => {
    const [moves, items, abilities, natures, species] = await Promise.all([
      prisma.move.findMany({ select: { nameEn: true, nameEs: true } }),
      prisma.item.findMany({ select: { nameEn: true, nameEs: true } }),
      prisma.ability.findMany({ select: { nameEn: true, nameEs: true } }),
      prisma.nature.findMany({ select: { nameEn: true, nameEs: true } }),
      prisma.species.findMany({ select: { nameEn: true, nameEs: true } }),
    ]);
    const map = new Map<string, string>();
    for (const row of [...species, ...abilities, ...natures, ...items, ...moves]) {
      // Short or identical names are left alone: they are too easy to meet as ordinary words.
      if (row.nameEn.length >= 4 && row.nameEs && row.nameEs !== row.nameEn && !map.has(row.nameEn)) {
        map.set(row.nameEn, row.nameEs);
      }
    }
    const names = [...map.keys()].sort((a, b) => b.length - a.length).map(escape);
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
    return { map, re };
  })();
  return loading;
}

/**
 * Writes the game names found in a text the way the player's language shows them. Only English names exactly
 * as the English game spells them are touched, so it is safe on text the model wrote in Spanish.
 */
export async function localizeNames(text: string, lang: Lang): Promise<string> {
  if (lang !== 'es' || !text) return text;
  const { map, re } = await load();
  return text.replace(re, (name) => map.get(name) ?? name);
}
