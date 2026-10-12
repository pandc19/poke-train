import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_AI_MESSAGE, WORKSPACE_MESSAGE } from '@/lib/ai/messages';
import { FIELDS } from '@/lib/import/fields';
import { ISSUE_TEXT } from '@/lib/import/issues';
import { ES } from '@/lib/messages-es';
import { makeT } from '@/lib/translate';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

/** Every plain string passed to t(), apiError() or new AiError() anywhere in src. */
function usedTexts(): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /\b(?:t|apiError|AiError)\(\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  for (const file of sourceFiles('src')) {
    if (file.endsWith('messages-es.ts')) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(pattern)) {
      const key = match[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
      if (key.trim()) found.set(key, file);
    }
  }
  return found;
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('translations', () => {
  const used = usedTexts();

  it('finds the interface texts to check', () => {
    expect(used.size).toBeGreaterThan(200);
  });

  it('has a Spanish text for every string used in the code', () => {
    // A string passed through a variable is not seen above, so those sources are checked here.
    const dynamic = [
      ...Object.values(ISSUE_TEXT),
      ...FIELDS.map((f) => f.label),
      ...FIELDS.map((f) => f.hint).filter(Boolean),
      NO_AI_MESSAGE,
      WORKSPACE_MESSAGE,
    ];
    const missing = [...[...used.keys()].filter((k) => !(k in ES)), ...dynamic.filter((k) => !(k in ES))].filter(
      // the first half of a message built from two literals is not a key on its own
      (k) => !k.endsWith('.env.local ')
    );
    expect(missing).toEqual([]);
  });

  it('keeps the same {placeholders} in every translation', () => {
    const wrong = Object.entries(ES).filter(([en, es]) => placeholders(en) !== placeholders(es));
    expect(wrong.map(([en]) => en)).toEqual([]);
  });

  it('has no leftover entries for texts that are no longer used', () => {
    const dynamic = new Set<string>([
      ...Object.values(ISSUE_TEXT),
      ...FIELDS.map((f) => f.label),
      ...FIELDS.map((f) => f.hint),
      NO_AI_MESSAGE,
      WORKSPACE_MESSAGE,
    ]);
    const unused = Object.keys(ES).filter((k) => !used.has(k) && !dynamic.has(k));
    // Spanish is a lookup keyed by English text; stale rows are harmless but worth removing.
    expect(unused).toEqual([]);
  });
});

describe('makeT', () => {
  it('returns the English text for English and fills placeholders', () => {
    expect(makeT('en')('{game} Pokédex', { game: 'Violet' })).toBe('Violet Pokédex');
  });

  it('translates to Spanish and fills placeholders', () => {
    expect(makeT('es')('{game} Pokédex', { game: 'Violet' })).toBe('Pokédex de Violet');
  });

  it('falls back to the English text when nothing is translated', () => {
    expect(makeT('es')('A text nobody translated {n}', { n: 3 })).toBe('A text nobody translated 3');
  });

  it('leaves an unknown placeholder visible instead of failing', () => {
    expect(makeT('en')('Hello {who}')).toBe('Hello {who}');
  });
});
