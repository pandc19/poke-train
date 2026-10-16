import { cookies } from 'next/headers';
import { THEME_COOKIE, type Theme } from './theme';

/** The mode the player picked, or null to follow their system. */
export async function getTheme(): Promise<Theme | null> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === 'light' || value === 'dark' ? value : null;
}
