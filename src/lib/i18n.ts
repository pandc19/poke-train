import { cookies } from 'next/headers';

/** Language used for Pokémon, move, item, ability and nature names. */
export type Lang = 'es' | 'en';
export const LANG_COOKIE = 'lang';

export async function getLang(): Promise<Lang> {
  return (await cookies()).get(LANG_COOKIE)?.value === 'en' ? 'en' : 'es';
}

export function pickName(row: { nameEn: string; nameEs: string }, lang: Lang): string {
  return lang === 'en' ? row.nameEn : row.nameEs;
}
