'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LANG_COOKIE, type Lang } from '@/lib/i18n';

export async function setLang(lang: Lang) {
  (await cookies()).set(LANG_COOKIE, lang, { maxAge: 60 * 60 * 24 * 365, path: '/' });
  revalidatePath('/', 'layout');
}
