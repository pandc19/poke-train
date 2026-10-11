'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Sprite } from './Sprite';
import type { DexCell } from '@/lib/pokedex';
import type { Lang } from '@/lib/i18n';

type Filter = 'all' | 'missing' | 'caught';

/**
 * Ordered Pokédex grid. Click toggles one Pokémon, shift-click fills the
 * range since the last click, and dragging with the mouse paints every cell
 * it passes over. Changes are applied optimistically and sent as one batch.
 *
 * With `gameId` null the grid is read-only (National Dex: state is derived
 * from the game profiles).
 */
export function DexGrid({
  cells,
  lang,
  gameId,
  accent = '#facc15',
}: {
  cells: DexCell[];
  lang: Lang;
  gameId: string | null;
  accent?: string;
}) {
  const readOnly = gameId === null;
  const [caught, setCaught] = useState(
    () => new Set(cells.filter((c) => c.caught || (readOnly && c.caughtIn.length > 0)).map((c) => c.speciesId))
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  // Drag-paint state lives in refs: it changes on every pointer move and must not re-render.
  const paint = useRef<{ mode: boolean; ids: Set<number> } | null>(null);
  const lastIndex = useRef<number | null>(null);
  const pointerHandled = useRef(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cells.filter((c) => {
      if (filter === 'missing' && caught.has(c.speciesId)) return false;
      if (filter === 'caught' && !caught.has(c.speciesId)) return false;
      if (!q) return true;
      return (
        c.nameEn.toLowerCase().includes(q) ||
        c.nameEs.toLowerCase().includes(q) ||
        String(c.entryNumber) === q ||
        String(c.speciesId) === q
      );
    });
    // `caught` is deliberately left out: a cell should not vanish from a
    // filtered view the instant it is toggled, only on the next filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, query, filter]);

  const apply = useCallback((ids: number[], mode: boolean) => {
    setCaught((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (mode) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const save = useCallback(
    async (ids: number[], mode: boolean) => {
      if (readOnly || ids.length === 0) return;
      setError(null);
      try {
        const res = await fetch('/api/pokedex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, speciesIds: ids, caught: mode }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        apply(ids, !mode);
        setError('Could not save that change. It has been undone; try again.');
      }
    },
    [apply, gameId, readOnly]
  );

  useEffect(() => {
    const end = () => {
      const p = paint.current;
      paint.current = null;
      if (p) void save([...p.ids], p.mode);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [save]);

  const onPointerDown = (e: React.PointerEvent, index: number) => {
    if (readOnly || e.pointerType !== 'mouse' || e.button !== 0) return;
    pointerHandled.current = true;
    const cell = visible[index];
    const mode = !caught.has(cell.speciesId);

    if (e.shiftKey && lastIndex.current !== null) {
      const [a, b] = [lastIndex.current, index].sort((x, y) => x - y);
      const ids = visible.slice(a, b + 1).map((c) => c.speciesId);
      apply(ids, mode);
      void save(ids, mode);
    } else {
      paint.current = { mode, ids: new Set([cell.speciesId]) };
      apply([cell.speciesId], mode);
    }
    lastIndex.current = index;
  };

  const onPointerEnter = (index: number) => {
    const p = paint.current;
    if (!p) return;
    const id = visible[index].speciesId;
    if (p.ids.has(id)) return;
    p.ids.add(id);
    apply([id], p.mode);
    lastIndex.current = index;
  };

  // Keyboard and touch arrive here without a preceding mouse pointerdown.
  const onClick = (index: number) => {
    if (pointerHandled.current) {
      pointerHandled.current = false;
      return;
    }
    if (readOnly) return;
    const id = visible[index].speciesId;
    const mode = !caught.has(id);
    apply([id], mode);
    void save([id], mode);
    lastIndex.current = index;
  };

  const setAllVisible = (mode: boolean) => {
    const ids = visible.filter((c) => caught.has(c.speciesId) !== mode).map((c) => c.speciesId);
    apply(ids, mode);
    void save(ids, mode);
  };

  const total = cells.length;
  const count = cells.filter((c) => caught.has(c.speciesId)).length;
  const pct = total ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>
              <span className="font-semibold text-ink">{count}</span> / {total} caught
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full"
              style={{ background: accent }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or number"
          aria-label="Search Pokémon"
          className="w-52 rounded-md border border-line bg-surface px-3 py-1.5 text-sm placeholder:text-muted"
        />

        <div className="flex rounded-md border border-line text-xs">
          {(['all', 'missing', 'caught'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 capitalize ${filter === f ? 'bg-surface-2 font-semibold' : 'text-muted'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {!readOnly && (
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setAllVisible(true)}
              className="rounded-md border border-line px-3 py-1.5 hover:border-done hover:text-done"
            >
              Mark shown caught
            </button>
            <button
              onClick={() => setAllVisible(false)}
              className="rounded-md border border-line px-3 py-1.5 text-muted hover:text-ink"
            >
              Clear shown
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-md border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No Pokémon match this filter.</p>
      ) : (
        <ul className="grid select-none grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
          {visible.map((c, i) => {
            const isCaught = caught.has(c.speciesId);
            const name = lang === 'en' ? c.nameEn : c.nameEs;
            const elsewhere = readOnly ? c.caughtIn : isCaught ? [] : c.caughtIn;
            return (
              <li key={c.speciesId}>
                <motion.button
                  type="button"
                  disabled={readOnly}
                  aria-pressed={isCaught}
                  title={
                    c.caughtIn.length ? `${name} · caught in ${c.caughtIn.join(', ')}` : name
                  }
                  onPointerDown={(e) => onPointerDown(e, i)}
                  onPointerEnter={() => onPointerEnter(i)}
                  onClick={() => onClick(i)}
                  whileTap={readOnly ? undefined : { scale: 0.92 }}
                  className={`relative flex w-full flex-col items-center rounded-lg border px-1 pb-1.5 pt-1 transition-colors ${
                    isCaught ? 'border-line bg-surface-2' : 'border-transparent bg-surface hover:border-line'
                  } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="self-start pl-1 font-mono text-[10px] text-muted">
                    #{String(c.entryNumber).padStart(3, '0')}
                  </span>
                  <motion.span
                    animate={{ scale: isCaught ? 1 : 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Sprite src={c.spriteUrl} alt="" silhouette={!isCaught} />
                  </motion.span>
                  <span className={`w-full truncate text-center text-[11px] ${isCaught ? 'text-ink' : 'text-muted'}`}>
                    {name}
                  </span>

                  {c.roster !== 'none' && (
                    <span
                      className={`absolute right-1 top-0.5 text-sm ${
                        c.roster === 'done' ? 'text-star' : 'text-pending'
                      }`}
                      title={c.roster === 'done' ? 'Trained roster: complete' : 'Trained roster: in progress'}
                    >
                      {c.roster === 'done' ? '★' : '☆'}
                    </span>
                  )}

                  {elsewhere.length > 0 && (
                    <span className="absolute bottom-6 left-1 flex gap-0.5">
                      {elsewhere.map((g) => (
                        <span
                          key={g}
                          className="rounded bg-done/20 px-1 text-[9px] font-semibold leading-4 text-done"
                        >
                          {g}
                        </span>
                      ))}
                    </span>
                  )}
                </motion.button>
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <p className="mt-4 text-xs text-muted">
          Click to toggle. Shift-click fills a range. Drag across cells to paint several at once.
        </p>
      )}
    </div>
  );
}
