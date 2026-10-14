'use client';

import { useRef } from 'react';
import { motion } from 'motion/react';
import { PokemonSprite, progressOf } from './parts';
import type { Lang } from '@/lib/i18n';
import type { RosterView } from '@/lib/roster';
import { useT } from '@/lib/translate-client';

export const PAGE_SIZE = 12;

/** The roster as small cards with paging. Choosing one shows it in the detail panel. */
export function RosterList({
  items,
  selectedId,
  onSelect,
  page,
  pageCount,
  onPage,
  total,
  lang,
  numberOf,
  accent,
}: {
  items: RosterView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  /** How many Pokémon match the filter, over all pages. */
  total: number;
  lang: Lang;
  numberOf: (p: RosterView) => string;
  accent: string;
}) {
  const { t } = useT();
  const start = page * PAGE_SIZE;
  const shown = items.slice(start, start + PAGE_SIZE);

  // A swipe sideways turns the page (touch and pen; vertical scrolling is left to the browser).
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const SWIPE_MIN = 60;

  return (
    <div
      style={{ touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        swipe.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const from = swipe.current;
        swipe.current = null;
        if (!from) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        // The click that ends a swipe on a card must not choose that card.
        swiped.current = true;
        setTimeout(() => (swiped.current = false), 0);
        const next = page + (dx < 0 ? 1 : -1);
        if (next >= 0 && next < pageCount) onPage(next);
      }}
      onClickCapture={(e) => {
        if (swiped.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onPointerCancel={() => {
        swipe.current = null;
      }}
    >
      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{t('No Pokémon match this filter.')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((p) => {
            const prog = progressOf(p);
            const selected = p.id === selectedId;
            const name = p.nickname ?? (lang === 'en' ? p.species.nameEn : p.species.nameEs);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  aria-current={selected ? 'true' : undefined}
                  title={name}
                  className={`relative flex w-full flex-col items-center rounded-lg border px-1.5 pb-2 pt-1.5 text-center transition-colors ${
                    selected ? 'bg-surface-2' : 'bg-surface hover:bg-surface-2'
                  } ${prog.complete ? 'border-done/60' : 'border-line'}`}
                  style={selected ? { outline: `2px solid ${accent}`, outlineOffset: 1 } : undefined}
                >
                  <span className="flex w-full items-center justify-between text-[10px] text-muted">
                    <span className="font-mono">{numberOf(p)}</span>
                    <span className="flex items-center gap-1">
                      {p.keeper && (
                        <span className="text-sm leading-none text-star" title={t('Keeper')} aria-label={t('Keeper')}>
                          ◆
                        </span>
                      )}
                      <span>{t('Lv. {level}', { level: p.level })}</span>
                    </span>
                  </span>
                  <PokemonSprite p={p} size={56} animated={false} />
                  <span className="mt-0.5 w-full truncate text-xs font-medium">{name}</span>
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                    <motion.span
                      className={`block h-full rounded-full ${prog.complete ? 'bg-done' : 'bg-pending'}`}
                      animate={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }}
                      transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                    />
                  </span>
                  <span className={`mt-0.5 text-[10px] ${prog.complete ? 'text-done' : 'text-pending'}`}>
                    {prog.complete ? t('Ready') : `${prog.done}/${prog.total}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <nav className="mt-3 flex items-center justify-between text-xs" aria-label={t('Pages')}>
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page === 0}
            className="rounded-md border border-line px-3 py-1.5 disabled:opacity-40"
          >
            ← {t('Previous')}
          </button>
          <span className="text-muted">
            {t('Page {page} of {pages}', { page: page + 1, pages: pageCount })} · {total}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pageCount - 1}
            className="rounded-md border border-line px-3 py-1.5 disabled:opacity-40"
          >
            {t('Next')} →
          </button>
        </nav>
      )}
    </div>
  );
}
