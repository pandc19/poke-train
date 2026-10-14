/**
 * Spanish names PokéAPI has differently from the games. Only the Spanish name changes; English keeps
 * PokéAPI's. Applied when names are synced and again whenever they are read (db.ts), so a restored
 * database or an old sync cannot bring the wrong name back.
 */
export const SPANISH_FIXES: { slug: string; nameEn: string; nameEs: string }[] = [
  { slug: 'flash-cannon', nameEn: 'Flash Cannon', nameEs: 'Foco Resplandor' },
  { slug: 'truant', nameEn: 'Truant', nameEs: 'Pereza' },
];

export const SPANISH_FIX_BY_SLUG = new Map(SPANISH_FIXES.map((f) => [f.slug, f.nameEs]));
const BY_ENGLISH = new Map(SPANISH_FIXES.map((f) => [f.nameEn, f.nameEs]));

/** Corrects the Spanish name of anything in a query result that has a fixed name, in place. */
export function applySpanishFixes<T>(value: T): T {
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v === null || typeof v !== 'object') return;
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return;
    const row = v as Record<string, unknown>;
    if (typeof row.nameEn === 'string' && 'nameEs' in row) {
      const fixed = BY_ENGLISH.get(row.nameEn);
      if (fixed) row.nameEs = fixed;
    }
    Object.values(row).forEach(walk);
  };
  walk(value);
  return value;
}
