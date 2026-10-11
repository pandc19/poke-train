import { levenshtein, normalizeKey } from './text';

export type NamedEntry = { id: number; slug: string; nameEn: string; nameEs: string };
export type Match = { id: number; slug: string; nameEn: string; nameEs: string; exact: boolean };

export type Matcher = (raw: string) => Match | null;

/**
 * Builds a name matcher over English names, Spanish names and slugs.
 * Exact (normalized) hits win; otherwise the closest name within a small
 * edit distance is accepted, so "Vidaesfera" finds "Vidasfera" but an
 * unknown name stays unknown rather than being forced onto something.
 *
 * @param aliases normalized spelling -> slug, for community or older names
 *                that differ from the official one by more than a typo.
 */
export function createMatcher(entries: NamedEntry[], aliases: Record<string, string> = {}): Matcher {
  const exact = new Map<string, NamedEntry>();
  for (const e of entries) {
    // Earlier entries win, so a base move is not shadowed by a later variant.
    for (const key of [normalizeKey(e.nameEs), normalizeKey(e.nameEn), normalizeKey(e.slug)]) {
      if (key && !exact.has(key)) exact.set(key, e);
    }
  }
  const bySlug = new Map(entries.map((e) => [e.slug, e]));
  const keys = [...exact.keys()];

  return (raw) => {
    const key = normalizeKey(raw);
    if (!key) return null;

    const alias = aliases[key];
    const hit = exact.get(key) ?? (alias ? bySlug.get(alias) : undefined);
    if (hit) return { ...hit, exact: true };

    const maxDistance = key.length >= 8 ? 2 : key.length >= 5 ? 1 : 0;
    if (!maxDistance) return null;
    let best: { entry: NamedEntry; distance: number } | null = null;
    let tie = false;
    for (const k of keys) {
      if (Math.abs(k.length - key.length) > maxDistance) continue;
      const distance = levenshtein(key, k);
      if (distance > maxDistance) continue;
      const entry = exact.get(k)!;
      if (!best || distance < best.distance) {
        best = { entry, distance };
        tie = false;
      } else if (distance === best.distance && entry.id !== best.entry.id) {
        tie = true;
      }
    }
    // Two different names equally close: refuse to guess.
    return best && !tie ? { ...best.entry, exact: false } : null;
  };
}

/** Spellings seen in Spanish-language guides that are not the official names. */
export const ALIASES = {
  moves: {
    vientocola: 'tailwind',
    focoresplandor: 'flash-cannon',
    colmillofuego: 'fire-fang',
    reposo: 'rest',
    genuflexion: 'kowtow-cleave',
    psicocarga: 'psyshock',
    tierraviva: 'earth-power',
  },
  items: {
    cintaelegida: 'choice-band',
    panueloelegido: 'choice-scarf',
    gafaselegidas: 'choice-specs',
    bandafocus: 'focus-sash',
    lentemetronomo: 'metronome',
    restos: 'leftovers',
  },
  abilities: {
    fuerzabruta: 'sheer-force',
  },
  natures: {},
  species: {},
} satisfies Record<string, Record<string, string>>;
