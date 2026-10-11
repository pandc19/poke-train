'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ConfirmDialog } from './Dialog';
import { Sprite } from './Sprite';
import type { DexCell } from '@/lib/pokedex';
import type { Lang } from '@/lib/i18n';

type Filter = 'all' | 'missing' | 'caught' | 'have' | 'registered';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  missing: 'Missing',
  caught: 'Caught',
  have: 'Have now',
  registered: 'Not in my box',
};
type Genders = { male: boolean; female: boolean };

/**
 * Ordered Pokédex grid. Click toggles one Pokémon, shift-click fills the
 * range since the last click, and dragging with the mouse paints every cell
 * it passes over. Changes are applied optimistically and sent as one batch.
 * Caught means the Pokédex lists it; ✓ means you have one right now. A
 * caught Pokémon without ✓ evolved or was released. On a caught Pokémon that
 * has both genders, the ♂/♀ buttons record which ones you have, which is what
 * the breeding planner uses.
 *
 * A game's National Dex lists every species. Those the game does not have
 * (`inGame` false) are dimmed and hidden by default, so progress counts only
 * what can be caught in that game.
 */
export function DexGrid({
  cells,
  lang,
  gameId,
  gameName,
  accent = '#facc15',
}: {
  cells: DexCell[];
  lang: Lang;
  gameId: string | null;
  gameName?: string;
  accent?: string;
}) {
  const readOnly = gameId === null;
  const hasUnavailable = cells.some((c) => !c.inGame);
  const [onlyInGame, setOnlyInGame] = useState(true);
  const [caught, setCaught] = useState(
    () => new Set(cells.filter((c) => c.caught || (readOnly && c.caughtIn.length > 0)).map((c) => c.speciesId))
  );
  /** Caught Pokémon the player has said they no longer have (evolved or released). */
  const [notOwned, setNotOwned] = useState(
    () => new Set(cells.filter((c) => c.caught && !c.owned).map((c) => c.speciesId))
  );
  const [genders, setGenders] = useState<Record<number, Genders>>(() =>
    Object.fromEntries(cells.map((c) => [c.speciesId, { male: c.hasMale, female: c.hasFemale }]))
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bulk, setBulk] = useState<{ mode: boolean; ids: number[] } | null>(null);

  // Drag-paint state lives in refs: it changes on every pointer move and must not re-render.
  const paint = useRef<{ mode: boolean; ids: Set<number> } | null>(null);
  const lastIndex = useRef<number | null>(null);
  const pointerHandled = useRef(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cells.filter((c) => {
      if (hasUnavailable && onlyInGame && !c.inGame) return false;
      if (filter === 'missing' && caught.has(c.speciesId)) return false;
      if (filter === 'caught' && !caught.has(c.speciesId)) return false;
      const have = caught.has(c.speciesId) && (!notOwned.has(c.speciesId) || c.ownedViaRoster);
      if (filter === 'have' && !have) return false;
      if (filter === 'registered' && !(caught.has(c.speciesId) && !have)) return false;
      if (!q) return true;
      return (
        c.nameEn.toLowerCase().includes(q) ||
        c.nameEs.toLowerCase().includes(q) ||
        String(c.entryNumber) === q ||
        String(c.speciesId) === q
      );
    });
    // `caught` and `notOwned` are deliberately left out: a cell should not vanish
    // from a filtered view the instant it is toggled, only on the next filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, query, filter, onlyInGame, hasUnavailable]);

  const apply = useCallback((ids: number[], mode: boolean) => {
    setCaught((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (mode) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    // Un-catching forgets the recorded genders and ownership, as the server does.
    // A newly caught Pokémon starts as owned, so it is never in the not-owned set.
    if (!mode) {
      setNotOwned((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setGenders((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = { male: false, female: false };
        return next;
      });
    }
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

  async function setHave(speciesId: number, value: boolean) {
    const toggle = (have: boolean) =>
      setNotOwned((prev) => {
        const next = new Set(prev);
        if (have) next.delete(speciesId);
        else next.add(speciesId);
        return next;
      });
    toggle(value);
    setError(null);
    try {
      const res = await fetch('/api/pokedex', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, speciesId, owned: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      toggle(!value);
      setError('Could not save that change. It has been undone; try again.');
    }
  }

  async function setGender(speciesId: number, which: keyof Genders, value: boolean) {
    const before = genders[speciesId] ?? { male: false, female: false };
    setGenders((prev) => ({ ...prev, [speciesId]: { ...before, [which]: value } }));
    setError(null);
    try {
      const res = await fetch('/api/pokedex', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          speciesId,
          [which === 'male' ? 'hasMale' : 'hasFemale']: value,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setGenders((prev) => ({ ...prev, [speciesId]: before }));
      setError('Could not save that gender. It has been undone; try again.');
    }
  }

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

  /** Bulk changes always go through a confirmation that says how many Pokémon are affected. */
  const askBulk = (mode: boolean) => {
    setMenuOpen(false);
    setBulk({ mode, ids: visible.filter((c) => caught.has(c.speciesId) !== mode).map((c) => c.speciesId) });
  };

  const confirmBulk = () => {
    if (!bulk) return;
    apply(bulk.ids, bulk.mode);
    void save(bulk.ids, bulk.mode);
    setBulk(null);
  };

  const scoped = hasUnavailable && onlyInGame ? cells.filter((c) => c.inGame) : cells;
  const total = scoped.length;
  const count = scoped.filter((c) => caught.has(c.speciesId)).length;
  const haveCount = scoped.filter(
    (c) => caught.has(c.speciesId) && (!notOwned.has(c.speciesId) || c.ownedViaRoster)
  ).length;
  const pct = total ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>
              <span className="font-semibold text-ink">{count}</span> / {total} caught
              <span className="ml-2">
                · <span className="font-semibold text-done">{haveCount}</span> have now
              </span>
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
          {(['all', 'missing', 'caught', 'have', 'registered'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 ${filter === f ? 'bg-surface-2 font-semibold' : 'text-muted'}`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {hasUnavailable && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={onlyInGame} onChange={(e) => setOnlyInGame(e.target.checked)} />
            Only Pokémon in {gameName ?? 'this game'}
          </label>
        )}

        {!readOnly && (
          <div className="relative ml-auto">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              Bulk actions ▾
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-line bg-surface p-1 text-xs shadow-xl">
                <p className="px-3 py-2 text-muted">
                  These act on the Pokémon currently shown, so search or filter first.
                </p>
                <button onClick={() => askBulk(true)} className="block w-full rounded px-3 py-2 text-left hover:bg-surface-2">
                  Mark all shown as caught…
                </button>
                <button
                  onClick={() => askBulk(false)}
                  className="block w-full rounded px-3 py-2 text-left text-red-400 hover:bg-surface-2"
                >
                  Remove all shown from caught…
                </button>
              </div>
            )}
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
        <ul className="grid select-none grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
          {visible.map((c, i) => {
            const isCaught = caught.has(c.speciesId);
            const name = lang === 'en' ? c.nameEn : c.nameEs;
            const elsewhere = readOnly ? c.caughtIn : isCaught ? [] : c.caughtIn;
            const mixed = c.genderRate > 0 && c.genderRate < 8;
            const g = genders[c.speciesId] ?? { male: false, female: false };
            const have = isCaught && (!notOwned.has(c.speciesId) || c.ownedViaRoster);
            const registeredOnly = isCaught && !have;
            const evo = c.evolvedInto ? (lang === 'en' ? c.evolvedInto.nameEn : c.evolvedInto.nameEs) : null;
            return (
              <li key={c.speciesId} className={`relative ${c.inGame ? '' : 'opacity-50'}`}>
                <motion.button
                  type="button"
                  disabled={readOnly}
                  aria-pressed={isCaught}
                  title={[name, !c.inGame && `not in ${gameName ?? 'this game'}`, c.caughtIn.length > 0 && `caught in ${c.caughtIn.join(', ')}`].filter(Boolean).join(' · ')}
                  onPointerDown={(e) => onPointerDown(e, i)}
                  onPointerEnter={() => onPointerEnter(i)}
                  onClick={() => onClick(i)}
                  whileTap={readOnly ? undefined : { scale: 0.92 }}
                  className={`relative flex w-full flex-col items-center rounded-lg border px-1 pb-1.5 pt-1 transition-colors ${
                    registeredOnly
                      ? 'border-dashed border-line bg-surface opacity-70'
                      : isCaught
                        ? 'border-line bg-surface-2'
                        : 'border-transparent bg-surface hover:border-line'
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
                  {registeredOnly && (
                    <span className="w-full truncate text-center text-[10px] text-pending">
                      {evo ? `evolved → ${evo}` : 'not in my box'}
                    </span>
                  )}
                  {/* keeps the row height equal whether or not the buttons below show */}
                  <span className="h-6" aria-hidden />

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

                  {have && evo && (
                    <span
                      className="absolute bottom-8 left-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-pending/20 px-1 text-[9px] font-semibold leading-4 text-pending"
                      title={`You also have ${evo}. If you evolved this one, un-tick the check mark.`}
                    >
                      ↗ {evo}
                    </span>
                  )}

                  {elsewhere.length > 0 && (
                    <span className="absolute bottom-8 left-1 flex gap-0.5">
                      {elsewhere.map((game) => (
                        <span
                          key={game}
                          className="rounded bg-done/20 px-1 text-[9px] font-semibold leading-4 text-done"
                        >
                          {game}
                        </span>
                      ))}
                    </span>
                  )}
                </motion.button>

                {!readOnly && isCaught && (
                  <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1">
                    <button
                      type="button"
                      aria-pressed={have}
                      disabled={c.ownedViaRoster}
                      title={
                        c.ownedViaRoster
                          ? 'You have this in your trained roster'
                          : have
                            ? 'You have one right now. Click if it evolved or you released it'
                            : 'Not in your box (it evolved or was released). Click if you have one again'
                      }
                      onClick={() => setHave(c.speciesId, !have)}
                      className={`h-5 w-6 rounded text-xs font-bold ${
                        have ? 'bg-done text-bg' : 'border border-pending/60 text-pending hover:bg-pending/10'
                      } disabled:cursor-default`}
                    >
                      ✓
                    </button>
                    {mixed && have && (
                      <>
                        <button
                          type="button"
                          aria-pressed={g.male}
                          title={g.male ? 'You have a male. Click to remove' : 'Click if you have a male'}
                          onClick={() => setGender(c.speciesId, 'male', !g.male)}
                          className={`h-5 w-6 rounded text-xs font-bold ${
                            g.male ? 'bg-sky-500 text-white' : 'border border-line text-muted hover:text-sky-400'
                          }`}
                        >
                          ♂
                        </button>
                        <button
                          type="button"
                          aria-pressed={g.female}
                          title={g.female ? 'You have a female. Click to remove' : 'Click if you have a female'}
                          onClick={() => setGender(c.speciesId, 'female', !g.female)}
                          className={`h-5 w-6 rounded text-xs font-bold ${
                            g.female ? 'bg-pink-500 text-white' : 'border border-line text-muted hover:text-pink-400'
                          }`}
                        >
                          ♀
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <p className="mt-4 text-xs text-muted">
          Click to toggle caught. Shift-click fills a range. Drag across cells to paint several at once. On a caught
          Pokémon, ✓ means you have one right now: un-tick it when it evolves or you release it, and it stays in the
          Pokédex as &quot;not in my box&quot;. ♂ and ♀ record which genders you have; the breeding planner uses that to
          find parents.
        </p>
      )}

      <ConfirmDialog
        open={bulk != null}
        title={bulk?.mode ? 'Mark shown Pokémon as caught?' : 'Remove shown Pokémon from caught?'}
        confirmLabel={
          bulk?.mode ? `Mark ${bulk.ids.length} as caught` : `Remove ${bulk?.ids.length ?? 0} from caught`
        }
        danger={bulk?.mode === false}
        disabled={!bulk || bulk.ids.length === 0}
        onConfirm={confirmBulk}
        onCancel={() => setBulk(null)}
      >
        {bulk && bulk.ids.length === 0 ? (
          <p>Nothing to change: every Pokémon currently shown is already {bulk.mode ? 'caught' : 'not caught'}.</p>
        ) : (
          <>
            <p>
              This will {bulk?.mode ? 'mark' : 'remove'} <strong className="text-ink">{bulk?.ids.length}</strong>{' '}
              Pokémon {bulk?.mode ? 'as caught and as ones you have now' : 'from your caught list'}. Only the Pokémon
              currently shown are affected (your search and filter apply).
            </p>
            {bulk?.mode === false && (
              <p className="mt-2 text-red-400">
                This also forgets the ✓ and the ♂/♀ you recorded for them. There is no undo.
              </p>
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
