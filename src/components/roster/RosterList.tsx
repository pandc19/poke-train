'use client';

import { useRef } from 'react';
import { motion } from 'motion/react';
import { PokemonSprite, progressOf } from './parts';
import type { Lang } from '@/lib/i18n';
import type { RosterView } from '@/lib/roster';
import { useT } from '@/lib/translate-client';
import { KeeperIcon, TrainingIcon } from '../KeeperIcon';

export const PAGE_SIZE = 12;

/** ♂ / ♀ for a card: the gender recorded, or the one a single-gender species always has. Null when unknown or genderless. */
function genderMark(p: RosterView): { symbol: string; color: string; label: { en: string; es: string } } | null {
  const male = p.gender === 'MALE' || (p.gender === 'UNKNOWN' && p.genderRate === 0);
  const female = p.gender === 'FEMALE' || (p.gender === 'UNKNOWN' && p.genderRate === 8);
  if (male) return { symbol: '♂', color: 'text-sky-400', label: { en: 'Male', es: 'Macho' } };
  if (female) return { symbol: '♀', color: 'text-pink-400', label: { en: 'Female', es: 'Hembra' } };
  return null;
}

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
  team,
  onAddToTeam,
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
  /** The team's slots (roster ids, null = empty). */
  team: (string | null)[];
  onAddToTeam: (id: string) => void;
}) {
  const { t } = useT();
  const start = page * PAGE_SIZE;
  const shown = items.slice(start, start + PAGE_SIZE);
  const teamFull = !team.includes(null);

  // A swipe sideways turns the page. Touch events are used because pointer events are cancelled the moment the
  // browser starts scrolling, which on a tablet happens with the slightest vertical drift.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const SWIPE_MIN = 50;

  return (
    <div
      style={{ touchAction: 'pan-y' }}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        swipe.current = e.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const from = swipe.current;
        swipe.current = null;
        const touch = e.changedTouches[0];
        if (!from || !touch) return;
        const dx = touch.clientX - from.x;
        const dy = touch.clientY - from.y;
        if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        // The click that ends a swipe on a card must not choose that card.
        swiped.current = true;
        setTimeout(() => (swiped.current = false), 400);
        const next = page + (dx < 0 ? 1 : -1);
        if (next >= 0 && next < pageCount) onPage(next);
      }}
      onTouchCancel={() => {
        swipe.current = null;
      }}
      onClickCapture={(e) => {
        if (swiped.current) {
          e.stopPropagation();
          e.preventDefault();
        }
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
              <li key={p.id} className="relative">
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
                        <span className="text-violet-500" title={t('Keeper')} aria-label={t('Keeper')}>
                          <KeeperIcon size={20} />
                        </span>
                      )}
                      {p.training && (
                        <span className="text-teal-500" title={t('Training')} aria-label={t('Training')}>
                          <TrainingIcon size={20} />
                        </span>
                      )}
                      <span>{t('Lv. {level}', { level: p.level })}</span>
                    </span>
                  </span>
                  <PokemonSprite p={p} size={56} animated={false} />
                  <span className="mt-0.5 flex w-full items-center justify-center gap-1 text-xs font-medium">
                    <span className="truncate">{name}</span>
                    {genderMark(p) && (
                      <span className={`shrink-0 font-bold ${genderMark(p)!.color}`} title={genderMark(p)!.label[lang]}>
                        {genderMark(p)!.symbol}
                      </span>
                    )}
                  </span>
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
                {/* A button of its own, since a card is already a button: where it is in the team, or add it. */}
                {team.includes(p.id) ? (
                  <span
                    className="pointer-events-none absolute bottom-1 left-1 rounded bg-surface-2 px-1 text-[10px] font-semibold text-muted"
                    title={t('In the team, slot {n}', { n: team.indexOf(p.id) + 1 })}
                  >
                    {team.indexOf(p.id) + 1}
                  </span>
                ) : (
                  !teamFull && (
                    <button
                      type="button"
                      onClick={() => onAddToTeam(p.id)}
                      aria-label={t('Add to the team')}
                      title={t('Add to the team')}
                      className="absolute bottom-1 left-1 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-sm font-bold leading-none text-muted hover:text-ink"
                    >
                      +
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <nav className="mt-3 flex flex-wrap items-center justify-between gap-1.5 text-xs" aria-label={t('Pages')}>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPage(0)}
              disabled={page === 0}
              aria-label={t('First page')}
              title={t('First page')}
              className="rounded-md border border-line px-2.5 py-1.5 disabled:opacity-40"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => onPage(page - 1)}
              disabled={page === 0}
              className="rounded-md border border-line px-3 py-1.5 disabled:opacity-40"
            >
              ← {t('Previous')}
            </button>
          </div>
          <span className="text-muted">
            {t('Page {page} of {pages}', { page: page + 1, pages: pageCount })} · {total}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPage(page + 1)}
              disabled={page >= pageCount - 1}
              className="rounded-md border border-line px-3 py-1.5 disabled:opacity-40"
            >
              {t('Next')} →
            </button>
            <button
              type="button"
              onClick={() => onPage(pageCount - 1)}
              disabled={page >= pageCount - 1}
              aria-label={t('Last page')}
              title={t('Last page')}
              className="rounded-md border border-line px-2.5 py-1.5 disabled:opacity-40"
            >
              »
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
