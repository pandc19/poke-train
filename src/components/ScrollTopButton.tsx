'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/translate-client';

/**
 * Floating button, bottom right. Scrolled down it jumps to the top; once
 * there it offers to return to where you were.
 */
export function ScrollTopButton() {
  const { t } = useT();
  const topLabel = t('Back to top');
  const backLabel = t('Back to where I was');
  const [y, setY] = useState(0);
  const [returnTo, setReturnTo] = useState<number | null>(null);
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const now = window.scrollY;
      // Scrolling down on your own makes the remembered spot stale; the smooth jump up must not clear it.
      if (now > 600 && now > lastY.current) setReturnTo(null);
      lastY.current = now;
      setY(now);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const effectiveReturn = returnTo != null && y < 300 ? returnTo : null;

  const away = y > 600;
  if (!away && effectiveReturn == null) return null;
  const label = away ? topLabel : backLabel;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        if (away) {
          setReturnTo(window.scrollY);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (effectiveReturn != null) {
          window.scrollTo({ top: effectiveReturn, behavior: 'smooth' });
          setReturnTo(null);
        }
      }}
      className="fixed bottom-4 right-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-lg text-ink shadow-lg hover:bg-surface-2"
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={away ? '' : 'rotate-180'}
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
