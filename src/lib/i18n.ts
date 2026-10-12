import { cookies } from 'next/headers';
import { makeT, type Lang, type TFunction } from './translate';

export type { Lang, Localized, TFunction } from './translate';
export { pick } from './translate';

export const LANG_COOKIE = 'lang';

/** The language the player picked. Spanish until they choose otherwise. */
export async function getLang(): Promise<Lang> {
  return (await cookies()).get(LANG_COOKIE)?.value === 'en' ? 'en' : 'es';
}

/** For server components and route handlers: `const t = await getT();` */
export async function getT(): Promise<TFunction> {
  return makeT(await getLang());
}

export function pickName(row: { nameEn: string; nameEs: string }, lang: Lang): string {
  return lang === 'en' ? row.nameEn : row.nameEs;
}
