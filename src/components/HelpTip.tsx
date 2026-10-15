'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/translate-client';

/** A small "?" that opens a short explanation: a click or tap, so it works on a touch screen too. */
export function HelpTip({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block align-middle">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('Help')}
        title={t('Help')}
        onClick={() => setOpen((v) => !v)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-xs font-semibold text-muted hover:text-ink"
      >
        ?
      </button>
      {open && (
        <span
          role="dialog"
          className="absolute left-0 top-full z-40 mt-2 block w-[min(20rem,calc(100vw-2rem))] space-y-2 rounded-lg border border-line bg-surface p-3 text-left text-xs font-normal leading-relaxed shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
