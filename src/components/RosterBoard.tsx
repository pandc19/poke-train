'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './Dialog';
import { RosterDetail } from './roster/RosterDetail';
import { PAGE_SIZE, RosterList } from './roster/RosterList';
import { ComboInput, progressOf, withTask, type Gender } from './roster/parts';
import type { EvEstimateInfo } from './StatsEvs';
import type { TeamAudit } from '@/lib/ai/schema';
import type { EvSpread } from '@/lib/import/evs';
import type { Lang } from '@/lib/i18n';
import type { IvRatings } from '@/lib/iv-ratings';
import type { EditorOptions, RosterView } from '@/lib/roster';
import type { TaskKey, TaskStatus } from '@/lib/roster-status';
import { useT } from '@/lib/translate-client';

type Filter = 'all' | 'pending' | 'done';
type Sort = 'import' | 'dex' | 'national' | 'name' | 'progress';

/**
 * The trained roster: small cards with paging on the left, and everything about
 * the chosen Pokémon on the right, editable in place.
 */
export function RosterBoard({
  gameId,
  initial,
  initialSelectedId,
  options,
  lang,
  judge,
  evs,
  evTarget,
  aiEnabled,
  aiProvider,
  accent,
}: {
  gameId: string;
  initial: RosterView[];
  /** The Pokémon named in the address, if any. */
  initialSelectedId: string | null;
  options: EditorOptions;
  lang: Lang;
  /** The game has a Judge ("Juez"), so each Pokémon can carry its Potential. */
  judge: boolean;
  /** The game has EV training. */
  evs: boolean;
  /** A target spread is planned too (EVs are easy to retrain in this game). */
  evTarget: boolean;
  aiEnabled: boolean;
  aiProvider: string;
  accent: string;
}) {
  const { t } = useT();
  const sortLabels: Record<Sort, string> = {
    import: t('Spreadsheet order'),
    dex: t('Pokédex order (this game)'),
    national: t('National Dex number'),
    name: t('Name'),
    progress: t('Least finished first'),
  };

  const [roster, setRoster] = useState(initial);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('import');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(() => {
    const index = initial.findIndex((p) => p.id === initialSelectedId);
    return index >= 0 ? Math.floor(index / PAGE_SIZE) : 0;
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.some((p) => p.id === initialSelectedId) ? initialSelectedId : (initial[0]?.id ?? null)
  );
  const [removing, setRemoving] = useState<RosterView | null>(null);
  const [auditing, setAuditing] = useState<string | null>(null);
  const [openAudit, setOpenAudit] = useState<string | null>(null);
  const [team, setTeam] = useState<{ busy: boolean; result: TeamAudit | null }>({ busy: false, result: null });
  const [adding, setAdding] = useState('');
  const [error, setError] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const name = useCallback(
    (x: { nameEn: string; nameEs: string } | null | undefined) => (x ? (lang === 'en' ? x.nameEn : x.nameEs) : ''),
    [lang]
  );

  const replace = (p: RosterView) => setRoster((prev) => prev.map((x) => (x.id === p.id ? p : x)));

  async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? t('Request failed ({status})', { status: res.status }));
    return data as T;
  }

  function select(id: string) {
    setSelectedId(id);
    // Keep the address in step, so a reload or a link comes back to the same Pokémon.
    window.history.replaceState(null, '', `?p=${id}`);
    // On a narrow screen the detail is below the list: bring it into view.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function toggle(p: RosterView, key: TaskKey, current: TaskStatus) {
    const status: TaskStatus = current === 'DONE' ? 'PENDING' : 'DONE';
    setError(null);
    replace(withTask(p, key, status));
    try {
      await api(`/api/roster/${p.id}`, 'PATCH', { task: { key, status } });
    } catch {
      replace(p);
      setError(t('Could not save that change. It has been undone; try again.'));
    }
  }

  async function changeGender(p: RosterView, gender: Gender) {
    setError(null);
    replace({ ...p, gender });
    try {
      await api(`/api/roster/${p.id}`, 'PATCH', { set: { gender } });
    } catch {
      replace(p);
      setError(t('Could not save the gender. It has been undone; try again.'));
    }
  }

  async function changePotential(p: RosterView, potential: RosterView['potential']) {
    setError(null);
    replace({ ...p, potential });
    try {
      // The server sends the Pokémon back: a new potential changes what the EVs mean.
      const data = await api<{ pokemon: RosterView }>(`/api/roster/${p.id}`, 'PATCH', { set: { potential } });
      replace(data.pokemon);
    } catch {
      replace(p);
      setError(t('Could not save the potential. It has been undone; try again.'));
    }
  }

  /** What the stats-to-EVs panel needs for this Pokémon: its base stats and the nature it really has. */
  const estimateFor = (p: RosterView): EvEstimateInfo | undefined => {
    if (!p.baseStats) return undefined;
    const nature = p.currentNature ?? p.targetNature;
    const effect = nature ? options.natures.find((n) => n.id === nature.id) : null;
    return {
      baseStats: p.baseStats,
      nature: effect ? { increased: effect.increased, decreased: effect.decreased } : null,
      natureName: nature ? name(nature) : null,
    };
  };

  /** Saves the stats and level; the server works the EVs out and sends the Pokémon back. */
  async function saveStats(p: RosterView, stats: EvSpread | null, level: number, ivRatings: IvRatings) {
    setError(null);
    replace({ ...p, currentStats: stats, level, ivRatings });
    try {
      const data = await api<{ pokemon: RosterView }>(`/api/roster/${p.id}`, 'PATCH', {
        set: { currentStats: stats, level, ivRatings: Object.values(ivRatings).some(Boolean) ? ivRatings : null },
      });
      replace(data.pokemon);
    } catch {
      replace(p);
      setError(t('Could not save that change. It has been undone; try again.'));
    }
  }

  /** Saves any fields; resolves to an error message, or null when it worked. */
  async function saveSet(p: RosterView, set: Record<string, unknown>): Promise<string | null> {
    try {
      const data = await api<{ pokemon: RosterView }>(`/api/roster/${p.id}`, 'PATCH', { set });
      replace(data.pokemon);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : t('Could not save');
    }
  }

  async function remove(p: RosterView) {
    setRemoving(null);
    try {
      await api(`/api/roster/${p.id}`, 'DELETE');
      const index = roster.findIndex((x) => x.id === p.id);
      const rest = roster.filter((x) => x.id !== p.id);
      setRoster(rest);
      if (selectedId === p.id) {
        const next = rest[Math.min(index, rest.length - 1)];
        setSelectedId(next?.id ?? null);
        window.history.replaceState(null, '', next ? `?p=${next.id}` : '?');
      }
    } catch {
      setError(t('Could not remove that Pokémon. Try again.'));
    }
  }

  async function add() {
    const wanted = adding.trim().toLowerCase();
    const species = options.species.find((s) => s.nameEn.toLowerCase() === wanted || s.nameEs.toLowerCase() === wanted);
    if (!species) {
      setError(t('"{name}" is not a Pokémon you can get in this game. Pick one from the suggestions.', { name: adding }));
      return;
    }
    setError(null);
    try {
      const data = await api<{ pokemon: RosterView }>('/api/roster', 'POST', { gameId, speciesId: species.id });
      setRoster((prev) => [...prev, data.pokemon]);
      setAdding('');
      // The new Pokémon goes to the end of the list: show it and open it.
      setFilter('all');
      setQuery('');
      setPage(Math.floor(roster.length / PAGE_SIZE));
      select(data.pokemon.id);
    } catch {
      setError(t('Could not add that Pokémon. Try again.'));
    }
  }

  async function audit(p: RosterView, refresh = false, deep = false) {
    setAuditing(p.id);
    setOpenAudit(p.id);
    setError(null);
    try {
      const data = await api<{ pokemon: RosterView }>('/api/ai/audit', 'POST', { rosterPokemonId: p.id, refresh, deep });
      replace(data.pokemon);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('The audit failed.'));
    } finally {
      setAuditing(null);
    }
  }

  async function auditTeam() {
    setTeam({ busy: true, result: null });
    setError(null);
    try {
      const data = await api<{ result: TeamAudit }>('/api/ai/team', 'POST', { gameId });
      setTeam({ busy: false, result: data.result });
    } catch (e) {
      setTeam({ busy: false, result: null });
      setError(e instanceof Error ? e.message : t('The roster audit failed.'));
    }
  }

  const complete = useMemo(() => roster.filter((p) => progressOf(p).complete).length, [roster]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = roster.filter((p) => {
      if (filter !== 'all' && progressOf(p).complete !== (filter === 'done')) return false;
      if (!q) return true;
      return (
        p.species.nameEn.toLowerCase().includes(q) ||
        p.species.nameEs.toLowerCase().includes(q) ||
        (p.nickname ?? '').toLowerCase().includes(q) ||
        String(p.nationalNumber) === q
      );
    });
    if (sort === 'import') return filtered;
    const byName = (a: RosterView, b: RosterView) =>
      name(a.species).localeCompare(name(b.species), lang) || a.nationalNumber - b.nationalNumber;
    const ratio = (p: RosterView) => {
      const { done, total } = progressOf(p);
      return total ? done / total : 1;
    };
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'dex':
          // Pokémon the game does not list go last, in National order.
          return (
            (a.dexOrder ?? Infinity) - (b.dexOrder ?? Infinity) ||
            a.nationalNumber - b.nationalNumber ||
            byName(a, b)
          );
        case 'national':
          return a.nationalNumber - b.nationalNumber || byName(a, b);
        case 'name':
          return byName(a, b);
        default:
          return ratio(a) - ratio(b) || a.nationalNumber - b.nationalNumber;
      }
    });
  }, [roster, filter, sort, query, lang, name]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const selected = roster.find((p) => p.id === selectedId) ?? null;

  /** The number shown follows the active sort: the game's entry number, or the National one. */
  const numberLabel = (p: RosterView) =>
    `#${String(sort === 'dex' && p.entryNumber != null ? p.entryNumber : p.nationalNumber).padStart(3, '0')}`;

  const dialogs = (
    <>
      <ConfirmDialog
        open={removing != null}
        title={t('Remove from the roster?')}
        confirmLabel={t('Remove')}
        danger
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      >
        <p>
          {t('{name} and its checklist will be deleted. Your Pokédex is not changed.', {
            name: removing ? (removing.nickname ?? name(removing.species)) : '',
          })}
        </p>
      </ConfirmDialog>
      <datalist id="species-list">
        {options.species.map((s) => (
          <option key={s.id} value={name(s)} label={lang === 'en' ? s.nameEs : s.nameEn} />
        ))}
      </datalist>
    </>
  );

  const addBox = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
      className="flex gap-1"
    >
      <ComboInput
        list="species-list"
        value={adding}
        onChange={setAdding}
        placeholder={t('Add Pokémon…')}
        aria-label={t('Add a Pokémon by name')}
        className="w-40 rounded-md border border-line bg-surface px-2 py-1.5 text-xs placeholder:text-muted"
      />
      <button disabled={!adding.trim()} className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-40">
        {t('Add')}
      </button>
    </form>
  );

  if (roster.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
        <p className="text-lg font-semibold">{t('Your roster is empty')}</p>
        <p className="mt-1 text-sm text-muted">{t('Import your training spreadsheet, or add a Pokémon by name.')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href={`/${gameId}/import`} className="rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg">
            {t('Import a spreadsheet')}
          </Link>
          {addBox}
        </div>
        {error && <p className="mt-4 text-sm text-pending">{error}</p>}
        {dialogs}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-sm">
          <span className="font-semibold text-done">{complete}</span>
          <span className="text-muted"> {t('of {total} fully trained', { total: roster.length })}</span>
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {addBox}
          <button
            onClick={auditTeam}
            disabled={!aiEnabled || team.busy}
            title={
              aiEnabled
                ? t('One request that reviews your whole roster together ({provider})', { provider: aiProvider })
                : t('Add an API key to .env.local to enable AI audits')
            }
            className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-40"
          >
            {team.busy ? t('Auditing roster…') : t('AI roster audit')}
          </button>
        </div>
      </div>

      {!aiEnabled && (
        <p className="mb-3 text-xs text-muted">
          {t(
            'AI audits are off: no API key is configured. Move legality checks still run, since they use game data rather than AI.'
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-md border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">
          {error}
        </p>
      )}
      {team.result && (
        <div className="mb-4 rounded-lg border border-line bg-surface p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{t('Roster audit')}</h2>
            <button onClick={() => setTeam({ busy: false, result: null })} className="text-xs text-muted">
              {t('Close')}
            </button>
          </div>
          <p>{team.result.summary}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <AuditList title={t('Strengths')} items={team.result.strengths} />
            <AuditList title={t('Weaknesses')} items={team.result.weaknesses} />
            <AuditList title={t('Suggestions')} items={team.result.suggestions.map((s) => `${s.change}: ${s.reason}`)} />
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
        {/* ---------- the list ---------- */}
        <aside>
          <div className="mb-3 space-y-2">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={t('Search the roster')}
              aria-label={t('Search the roster')}
              className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm placeholder:text-muted"
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-line text-xs">
                {(['all', 'pending', 'done'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setFilter(f);
                      setPage(0);
                    }}
                    className={`px-3 py-1.5 ${filter === f ? 'bg-surface-2 font-semibold' : 'text-muted'}`}
                  >
                    {f === 'all' ? t('All') : f === 'pending' ? t('Pending') : t('Done')}
                  </button>
                ))}
              </div>
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
                {t('Sort')}
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as Sort);
                    setPage(0);
                  }}
                  className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-ink"
                >
                  {(Object.keys(sortLabels) as Sort[]).map((key) => (
                    <option key={key} value={key}>
                      {sortLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <RosterList
            items={visible}
            selectedId={selectedId}
            onSelect={select}
            page={currentPage}
            pageCount={pageCount}
            onPage={setPage}
            total={visible.length}
            lang={lang}
            numberOf={numberLabel}
            accent={accent}
          />
        </aside>

        {/* ---------- the detail ---------- */}
        <div ref={detailRef} className="min-w-0 scroll-mt-4">
          {selected ? (
            <RosterDetail
              key={selected.id}
              p={selected}
              options={options}
              lang={lang}
              judge={judge}
              evs={evs}
              evTarget={evTarget}
              estimate={estimateFor(selected)}
              numberLabel={numberLabel(selected)}
              aiEnabled={aiEnabled}
              auditing={auditing === selected.id}
              auditOpen={openAudit === selected.id}
              onToggle={(key, current) => toggle(selected, key, current)}
              onSet={(set) => saveSet(selected, set)}
              onGender={(g) => changeGender(selected, g)}
              onPotential={(v) => changePotential(selected, v)}
              onSaveStats={(stats, level, ratings) => saveStats(selected, stats, level, ratings)}
              onAudit={(refresh, deep) => audit(selected, refresh, deep)}
              onToggleAudit={() => setOpenAudit(openAudit === selected.id ? null : selected.id)}
              onRemove={() => setRemoving(selected)}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
              {t('Select a Pokémon to see and edit it.')}
            </p>
          )}
        </div>
      </div>
      {dialogs}
    </div>
  );
}

function AuditList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase text-muted">{title}</h3>
      <ul className="list-disc space-y-1 pl-4 text-xs">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
