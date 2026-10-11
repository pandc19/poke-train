/** Text helpers for reading hand-typed spreadsheets (accents, typos, lists). */

/** "Puño Fuego " -> "punofuego": case, accent, spacing and punctuation insensitive. */
export function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** "Firme (+ataque, -ataque especial)" -> "Firme" */
export function stripParens(s: string): string {
  return s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * "Life Orb or Choice Band", "Vidasfera / Banda Focus", "Alegre o Firme"
 * -> the individual options. Parentheses are removed first because they
 * hold explanations, which may themselves contain commas or slashes.
 */
export function splitAlternatives(s: string): string[] {
  return stripParens(s)
    .split(/\s+(?:o|or|u)\s+|\s*\/\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Splits a cell holding several moves. Accepts commas, semicolons, slashes,
 * new lines, and a full stop followed by a space (a common typo for a comma).
 */
export function splitList(s: string): string[] {
  return s
    .split(/[,;/\n]|\.\s+/)
    .map((p) => p.trim().replace(/\.$/, ''))
    .filter(Boolean);
}
