'use client';

import { THEME_COOKIE } from '@/lib/theme';
import { useT } from '@/lib/translate-client';

/**
 * Switches the screen between light and dark. It shows the mode it switches to (see globals.css),
 * so it is right before the page knows the system setting. The choice is kept in a cookie, which
 * the layout reads, so the next page opens in the same mode without a flash.
 */
export function ThemeToggle() {
  const { t } = useT();
  const toggle = () => {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = current === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  };
  const label = t('Switch between light and dark mode');
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid h-[30px] w-[30px] place-items-center rounded-md bg-black/20 text-white/85 shadow-inner hover:text-white"
    >
      {/* sun */}
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" className="theme-to-light" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </svg>
      {/* moon */}
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" className="theme-to-dark" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}
