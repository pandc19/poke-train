'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ConfirmDialog } from './Dialog';
import { PokemonInfoDialog } from './PokemonInfoDialog';
import { Sprite } from './Sprite';
import type { DexCell } from '@/lib/pokedex';
import type { Lang } from '@/lib/i18n';
import { useT } from '@/lib/translate-client';

type Filter = 'all' | 'missing' | 'caught' | 'have' | 'registered';

type Genders = { male: boolean; female: boolean };

/**
 * Ordered Pokédex grid.
 *
 *  - Click a card to open that Pokémon's information (from PokéAPI).
 *  - The "Caught" button on a card marks it in your Pokédex. Shift-click it
 *    to fill the range since the last one.
 *  - "Have" says you have one right now; a caught Pokémon without it evolved
 *    or was released. ♂/♀ record which genders you have, for breeding.
 *
 * Changes are applied optimistically and sent as one batch.
 *
 * A game's National Dex lists every species. Those the game does not have
 * (`inGame` false) are dimmed and hidden by default, so progress counts only
 * what can be caught in that game.
 */
export function DexGrid({
  cells,
  stateCells,
  lang,
  gameId,
  gameName,
  accent = '#facc15',
}: {
  cells: DexCell[];
  /**
   * Every Pokémon this grid may show over its lifetime, to start the caught state from.
   * Given when the same grid is reused for several lists (tabs), so none starts blank.
   */
  stateCells?: DexCell[];
  lang: Lang;
  gameId: string | null;
  gameName?: string;
  accent?: string;
}) {
  const { t } = useT();
  const filterLabels: Record<Filter, string> = {
    all: t('All'),
    missing: t('Missing'),
    caught: t('Caught'),
    have: t('Have now'),
    registered: t('Not in my box'),
  };
  const seed = stateCells ?? cells;
  const readOnly = gameId === null;
  const hasUnavailable = cells.some((c) => !c.inGame);
  const [onlyInGame, setOnlyInGame] = useState(true);
  const [caught, setCaught] = useState(
    () => new Set(seed.filter((c) => c.caught || (readOnly && c.caughtIn.length > 0)).map((c) => c.speciesId))
  );
  /** Caught Pokémon the player has said they no longer have (evolved or released). */
  const [notOwned, setNotOwned] = useState(
    () => new Set(seed.filter((c) => c.caught && !c.owned).map((c) => c.speciesId))
  );
  const [genders, setGenders] = useState<Record<number, Genders>>(() =>
    Object.fromEntries(seed.map((c) => [c.speciesId, { male: c.hasMale, female: c.hasFemale }]))
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bulk, setBulk] = useState<{ mode: boolean; ids: number[] } | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const lastIndex = useRef<number | null>(null);
  // A range starts from the last click in the list being shown, not one from another tab.
  useEffect(() => {
    lastIndex.current = null;
  }, [cells]);

  const haveNow = (c: DexCell) => caught.has(c.speciesId) && (!notOwned.has(c.speciesId) || c.ownedViaRoster);

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
    // A newly caught Pokémon is not marked as Have; the player ticks that themselves.
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
    } else {
      setNotOwned((prev) => {
        const next = new Set(prev);
        for (const id of ids) if (!caught.has(id)) next.add(id);
        return next;
      });
    }
  }, [caught]);

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
        setError(t('Could not save that change. It has been undone; try again.'));
      }
    },
    [apply, gameId, readOnly, t]
  );

  async function patch(body: Record<string, unknown>) {
    const res = await fetch('/api/pokedex', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, ...body }),
    });
    if (!res.ok) throw new Error(String(res.status));
  }

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
      await patch({ speciesId, owned: value });
    } catch {
      toggle(!value);
      setError(t('Could not save that change. It has been undone; try again.'));
    }
  }

  async function setGender(speciesId: number, which: keyof Genders, value: boolean) {
    const before = genders[speciesId] ?? { male: false, female: false };
    setGenders((prev) => ({ ...prev, [speciesId]: { ...before, [which]: value } }));
    setError(null);
    try {
      await patch({ speciesId, [which === 'male' ? 'hasMale' : 'hasFemale']: value });
    } catch {
      setGenders((prev) => ({ ...prev, [speciesId]: before }));
      setError(t('Could not save that gender. It has been undone; try again.'));
    }
  }

  /** The Caught button. Shift-click fills the range since the last click. */
  const toggleCaught = (index: number, shift: boolean) => {
    if (readOnly) return;
    const cell = visible[index];
    const mode = !caught.has(cell.speciesId);
    if (shift && lastIndex.current !== null) {
      const [a, b] = [lastIndex.current, index].sort((x, y) => x - y);
      const ids = visible.slice(a, b + 1).map((c) => c.speciesId);
      apply(ids, mode);
      void save(ids, mode);
    } else {
      apply([cell.speciesId], mode);
      void save([cell.speciesId], mode);
    }
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
  const haveCount = scoped.filter(haveNow).length;
  const pct = total ? Math.round((count / total) * 100) : 0;
  const openCell = cells.find((c) => c.speciesId === openId) ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>
              <span className="font-semibold text-ink">{count}</span> / {total} {t('caught')}
              <span className="ml-2">
                · <span className="font-semibold text-done">{haveCount}</span> {t('have now')}
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
          placeholder={t('Search name or number')}
          aria-label={t('Search Pokémon')}
          className="w-52 rounded-md border border-line bg-surface px-3 py-1.5 text-sm placeholder:text-muted"
        />

        <div className="flex flex-wrap rounded-md border border-line text-xs">
          {(['all', 'missing', 'caught', 'have', 'registered'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 ${filter === f ? 'bg-surface-2 font-semibold' : 'text-muted'}`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>

        {hasUnavailable && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={onlyInGame} onChange={(e) => setOnlyInGame(e.target.checked)} />
            {t('Only Pokémon in {game}', { game: gameName ?? t('this game') })}
          </label>
        )}

        {!readOnly && (
          <div className="relative ml-auto">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              {t('Bulk actions')} ▾
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-line bg-surface p-1 text-xs shadow-xl">
                <p className="px-3 py-2 text-muted">
                  {t('These act on the Pokémon currently shown, so search or filter first.')}
                </p>
                <button onClick={() => askBulk(true)} className="block w-full rounded px-3 py-2 text-left hover:bg-surface-2">
                  {t('Mark all shown as caught…')}
                </button>
                <button
                  onClick={() => askBulk(false)}
                  className="block w-full rounded px-3 py-2 text-left text-red-400 hover:bg-surface-2"
                >
                  {t('Remove all shown from caught…')}
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
        <p className="py-16 text-center text-sm text-muted">{t('No Pokémon match this filter.')}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-3">
          {visible.map((c, i) => {
            const isCaught = caught.has(c.speciesId);
            const name = lang === 'en' ? c.nameEn : c.nameEs;
            const elsewhere = isCaught ? [] : c.caughtIn;
            const mixed = c.genderRate > 0 && c.genderRate < 8;
            const g = genders[c.speciesId] ?? { male: false, female: false };
            const have = haveNow(c);
            const registeredOnly = isCaught && !have;
            const evo = c.evolvedInto ? (lang === 'en' ? c.evolvedInto.nameEn : c.evolvedInto.nameEs) : null;
            return (
              <li
                key={c.speciesId}
                className={`relative flex flex-col rounded-lg border px-1.5 pb-9 pt-1.5 transition-colors ${
                  registeredOnly
                    ? 'border-dashed border-line bg-surface opacity-80'
                    : isCaught
                      ? 'border-line bg-surface-2'
                      : 'border-transparent bg-surface hover:border-line'
                } ${c.inGame ? '' : 'opacity-50'}`}
              >
                <div className="flex items-center justify-between gap-1">
                  {readOnly ? (
                    <span />
                  ) : (
                    <button
                      type="button"
                      aria-pressed={isCaught}
                      onClick={(e) => toggleCaught(i, e.shiftKey)}
                      title={
                        isCaught
                          ? t('Caught. Click to remove from your Pokédex')
                          : t('Click to mark as caught (shift-click for a range)')
                      }
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        isCaught ? 'bg-done text-bg' : 'border border-line text-muted hover:border-muted hover:text-ink'
                      }`}
                    >
                      {isCaught ? `✓ ${t('Caught')}` : t('Catch')}
                    </button>
                  )}
                  <span className="font-mono text-[11px] text-muted">#{String(c.entryNumber).padStart(3, '0')}</span>
                  {c.roster !== 'none' ? (
                    <span
                      className={`text-sm leading-none ${c.roster === 'done' ? 'text-star' : 'text-pending'}`}
                      title={c.roster === 'done' ? 'Trained roster: complete' : 'Trained roster: in progress'}
                    >
                      {c.roster === 'done' ? '★' : '☆'}
                    </span>
                  ) : (
                    <span className="w-3" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setOpenId(c.speciesId)}
                  title={t('{name}: open details', { name })}
                  className="mt-1 flex w-full flex-col items-center rounded-md pb-1 hover:bg-bg/40 focus-visible:outline-2 focus-visible:outline-star"
                >
                  <motion.span
                    animate={{ scale: isCaught ? 1 : 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Sprite src={c.spriteUrl} alt="" size={88} silhouette={!isCaught} />
                  </motion.span>
                  <span className={`w-full truncate text-center text-xs font-medium ${isCaught ? 'text-ink' : 'text-muted'}`}>
                    {name}
                  </span>
                  {/* Notes sit on their own line under the name, never on top of it. */}
                  {c.exclusive && (
                    <span
                      className={`w-full truncate text-center text-[11px] ${
                        c.exclusive.own ? 'text-muted' : 'font-semibold text-pending'
                      }`}
                      title={
                        c.exclusive.own
                          ? t('Only in {version}, your version', { version: c.exclusive.versionName })
                          : t('Only in {version}: not in your game, so it needs a trade or a raid', {
                              version: c.exclusive.versionName,
                            })
                      }
                    >
                      {t('{version} only', { version: c.exclusive.versionName })}
                    </span>
                  )}
                  {registeredOnly && (
                    <span className="w-full truncate text-center text-[11px] text-pending">
                      {evo ? t('evolved → {name}', { name: evo }) : t('not in my box')}
                    </span>
                  )}
                  {have && evo && (
                    <span
                      className="w-full truncate text-center text-[11px] font-semibold text-pending"
                      title={t('You also have {name}. If you evolved this one, un-tick Have.', { name: evo })}
                    >
                      ↗ {evo}
                    </span>
                  )}
                  {elsewhere.length > 0 && (
                    <span className="flex w-full flex-wrap justify-center gap-0.5">
                      {elsewhere.map((game) => (
                        <span
                          key={game}
                          className="rounded bg-done/20 px-1 text-[10px] font-semibold leading-4 text-done"
                        >
                          {t('caught in {game}', { game })}
                        </span>
                      ))}
                    </span>
                  )}
                </button>

                {!readOnly && isCaught && (
                  <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1">
                    <button
                      type="button"
                      aria-pressed={have}
                      disabled={c.ownedViaRoster}
                      title={
                        c.ownedViaRoster
                          ? t('You have this in your trained roster')
                          : have
                            ? t('You have one right now. Click if it evolved or you released it')
                            : t('Not in your box (it evolved or was released). Click if you have one again')
                      }
                      onClick={() => setHave(c.speciesId, !have)}
                      className={`h-6 rounded px-2 text-[11px] font-bold ${
                        have ? 'bg-done text-bg' : 'border border-pending/60 text-pending hover:bg-pending/10'
                      } disabled:cursor-default`}
                    >
                      {t('Have')}
                    </button>
                    {mixed && have && (
                      <>
                        <button
                          type="button"
                          aria-pressed={g.male}
                          title={g.male ? t('You have a male. Click to remove') : t('Click if you have a male')}
                          onClick={() => setGender(c.speciesId, 'male', !g.male)}
                          className={`h-6 w-7 rounded text-sm font-bold ${
                            g.male ? 'bg-sky-500 text-white' : 'border border-line text-muted hover:text-sky-400'
                          }`}
                        >
                          ♂
                        </button>
                        <button
                          type="button"
                          aria-pressed={g.female}
                          title={g.female ? t('You have a female. Click to remove') : t('Click if you have a female')}
                          onClick={() => setGender(c.speciesId, 'female', !g.female)}
                          className={`h-6 w-7 rounded text-sm font-bold ${
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
          {t('Click a card to see that Pokémon\'s information. Use Catch to mark it in your Pokédex (shift-click fills a range). Have means you have one right now: un-tick it when it evolves or you release it, and it stays in the Pokédex as "not in my box". ♂ and ♀ record which genders you have; the breeding planner uses that to find parents.')}
        </p>
      )}

      <PokemonInfoDialog
        speciesId={openId}
        gameId={gameId}
        lang={lang}
        status={openCell ? { caught: caught.has(openCell.speciesId), have: haveNow(openCell) } : undefined}
        exclusive={openCell?.exclusive}
        entryNumber={openCell?.entryNumber}
        onClose={() => setOpenId(null)}
      />

      <ConfirmDialog
        open={bulk != null}
        title={bulk?.mode ? t('Mark shown Pokémon as caught?') : t('Remove shown Pokémon from caught?')}
        confirmLabel={
          bulk?.mode
            ? t('Mark {count} as caught', { count: bulk.ids.length })
            : t('Remove {count} from caught', { count: bulk?.ids.length ?? 0 })
        }
        danger={bulk?.mode === false}
        disabled={!bulk || bulk.ids.length === 0}
        onConfirm={confirmBulk}
        onCancel={() => setBulk(null)}
      >
        {bulk && bulk.ids.length === 0 ? (
          <p>
            {bulk.mode
              ? t('Nothing to change: every Pokémon currently shown is already caught.')
              : t('Nothing to change: every Pokémon currently shown is already not caught.')}
          </p>
        ) : (
          <>
            <p>
              {bulk?.mode
                ? t(
                    'This will mark {count} Pokémon as caught and as ones you have now. Only the Pokémon currently shown are affected (your search and filter apply).',
                    { count: bulk?.ids.length ?? 0 }
                  )
                : t(
                    'This will remove {count} Pokémon from your caught list. Only the Pokémon currently shown are affected (your search and filter apply).',
                    { count: bulk?.ids.length ?? 0 }
                  )}
            </p>
            {bulk?.mode === false && (
              <p className="mt-2 text-red-400">
                {t('This also forgets the Have mark and the ♂/♀ you recorded for them. There is no undo.')}
              </p>
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
