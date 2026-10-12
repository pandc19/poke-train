import { ES } from './messages-es';

/** Language of the whole app: the interface, and the names of Pokémon, moves, items and so on. */
export type Lang = 'es' | 'en';

export type Vars = Record<string, string | number>;

/**
 * Translates a piece of interface text. The English text is the key, so a
 * missing Spanish entry falls back to English instead of showing a code.
 * Placeholders look like {count} and are filled from `vars`.
 */
export type TFunction = (text: string, vars?: Vars) => string;

/** Text that lives in data (game config, constants) instead of in a component. */
export type Localized = { en: string; es: string };

export function makeT(lang: Lang): TFunction {
  return (text, vars) => {
    const raw = lang === 'es' ? (ES[text] ?? text) : text;
    return vars ? raw.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match)) : raw;
  };
}

export const pick = (text: Localized, lang: Lang): string => (lang === 'en' ? text.en : text.es);
