'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AuditPanel } from './AuditPanel';
import { RosterRowEditor } from './RosterRowEditor';
import { TypeBadge } from './TypeBadge';
import type { BuildAudit, TeamAudit } from '@/lib/ai/schema';
import { formatEvs } from '@/lib/import/evs';
import type { Lang } from '@/lib/i18n';
import { TYPE_COLORS } from '@/lib/pokemon-types';
import type { EditorOptions, RosterView } from '@/lib/roster';
import { rosterProgress, type TaskKey, type TaskStatus } from '@/lib/roster-status';

type View = 'cards' | 'table';
type Filter = 'all' | 'pending' | 'done';

const progressOf = (p: RosterView) =>
  rosterProgress({
    owned: p.owned,
    targetNatureId: p.targetNature?.id ?? null,
    natureStatus: p.natureStatus,
    abilityId: p.ability?.id ?? null,
    abilityStatus: p.abilityStatus,
    itemId: p.item?.id ?? null,
    itemNote: p.itemNote,
    itemStatus: p.itemStatus,
    evs: p.evs,
    evStatus: p.evStatus,
    moves: p.moves.map((m) => ({ slot: m.slot, moveId: m.move?.id ?? null, rawName: m.rawName, status: m.status })),
  });

/** Applies a task toggle locally, mirroring what PATCH /api/roster/[id] does. */
function withTask(p: RosterView, key: TaskKey, status: TaskStatus): RosterView {
  if (key.startsWith('move:')) {
    const slot = Number(key.slice(5));
    return { ...p, moves: p.moves.map((m) => (m.slot === slot ? { ...m, status } : m)) };
  }
  switch (key) {
    case 'owned':
      return { ...p, owned: status === 'DONE' };
    case 'nature':
      return { ...p, natureStatus: status };
    case 'ability':
      return { ...p, abilityStatus: status };
    case 'item':
      return { ...p, itemStatus: status };
    default:
      return { ...p, evStatus: status };
  }
}

/** A single micro-task: orange while pending, green once checked off. */
function TaskChip({
  label,
  status,
  onToggle,
  warning,
  accent,
  title,
  dense,
}: {
  label: React.ReactNode;
  status: TaskStatus;
  onToggle: () => void;
  warning?: string;
  accent?: string;
  title?: string;
  dense?: boolean;
}) {
  const done = status === 'DONE';
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.94 }}
      aria-pressed={done}
      title={warning ?? title ?? (done ? 'Done. Click to mark pending' : 'Pending. Click to mark done')}
      className={`inline-flex max-w-full items-center gap-1 rounded-md border text-left transition-colors ${
        dense ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
      } ${
        done
          ? 'border-done/50 bg-done/15 text-done'
          : 'border-pending/50 bg-pending/10 text-pending hover:bg-pending/20'
      }`}
      style={accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : undefined}
    >
      <span aria-hidden className="text-[10px]">
        {done ? '✓' : '○'}
      </span>
      <span className="truncate">{label}</span>
      {warning && (
        <span aria-label={warning} className="text-red-400">
          ⚠
        </span>
      )}
    </motion.button>
  );
}

function CardSprite({ p }: { p: RosterView }) {
  // Animated Showdown sprite when one exists, static PokéAPI sprite otherwise.
  const animated = p.formId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${p.formId}.gif`
    : null;
  const [src, setSrc] = useState(animated ?? p.spriteUrl);
  if (!src) return <span className="grid h-20 w-20 place-items-center rounded-full bg-surface-2 text-muted">?</span>;
  return (
    <span className="grid h-20 w-20 shrink-0 place-items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => src !== p.spriteUrl && setSrc(p.spriteUrl)}
        className={`max-h-20 max-w-20 ${p.owned ? '' : 'sprite-silhouette'} ${src === p.spriteUrl ? 'sprite' : ''}`}
      />
    </span>
  );
}

export function RosterBoard({
  gameId,
  initial,
  options,
  lang,
  aiEnabled,
  aiProvider,
}: {
  gameId: string;
  initial: RosterView[];
  options: EditorOptions;
  lang: Lang;
  aiEnabled: boolean;
  aiProvider: string;
}) {
  const [roster, setRoster] = useState(initial);
  const [view, setView] = useState<View>('cards');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [auditing, setAuditing] = useState<string | null>(null);
  const [openAudit, setOpenAudit] = useState<string | null>(null);
  const [team, setTeam] = useState<{ busy: boolean; result: TeamAudit | null }>({ busy: false, result: null });
  const [adding, setAdding] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
    return data as T;
  }

  async function toggle(p: RosterView, key: TaskKey, current: TaskStatus) {
    const status: TaskStatus = current === 'DONE' ? 'PENDING' : 'DONE';
    setError(null);
    replace(withTask(p, key, status));
    try {
      await api(`/api/roster/${p.id}`, 'PATCH', { task: { key, status } });
    } catch {
      replace(p);
      setError('Could not save that change. It has been undone; try again.');
    }
  }

  async function saveEdit(id: string, set: Record<string, unknown>): Promise<string | null> {
    try {
      const data = await api<{ pokemon: RosterView }>(`/api/roster/${id}`, 'PATCH', { set });
      replace(data.pokemon);
      setEditing(null);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save';
    }
  }

  async function remove(p: RosterView) {
    if (!window.confirm(`Remove ${name(p.species)} from the roster?`)) return;
    try {
      await api(`/api/roster/${p.id}`, 'DELETE');
      setRoster((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      setError('Could not remove that Pokémon. Try again.');
    }
  }

  async function add() {
    const wanted = adding.trim().toLowerCase();
    const species = options.species.find((s) => s.nameEn.toLowerCase() === wanted || s.nameEs.toLowerCase() === wanted);
    if (!species) {
      setError(`No Pokémon called "${adding}". Pick one from the suggestions.`);
      return;
    }
    setError(null);
    try {
      const data = await api<{ pokemon: RosterView }>('/api/roster', 'POST', { gameId, speciesId: species.id });
      setRoster((prev) => [...prev, data.pokemon]);
      setAdding('');
      setView('table');
      setEditing(data.pokemon.id);
    } catch {
      setError('Could not add that Pokémon. Try again.');
    }
  }

  async function audit(p: RosterView, refresh = false) {
    setAuditing(p.id);
    setOpenAudit(p.id);
    setError(null);
    try {
      const data = await api<{ pokemon: RosterView }>('/api/ai/audit', 'POST', { rosterPokemonId: p.id, refresh });
      replace(data.pokemon);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The audit failed.');
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
      setError(e instanceof Error ? e.message : 'The team audit failed.');
    }
  }

  const stats = useMemo(() => {
    const complete = roster.filter((p) => progressOf(p).complete).length;
    return { complete, total: roster.length };
  }, [roster]);

  const visible = roster.filter((p) => {
    if (filter === 'all') return true;
    return progressOf(p).complete === (filter === 'done');
  });

  /** The chips for one Pokémon, shared by both views. */
  const chips = (p: RosterView, dense: boolean) => {
    const natureLabel =
      p.currentNature && p.targetNature && p.currentNature.id !== p.targetNature.id && p.natureStatus === 'PENDING'
        ? `${name(p.currentNature)} → ${name(p.targetNature)}`
        : name(p.natureStatus === 'DONE' ? (p.currentNature ?? p.targetNature) : p.targetNature);
    return {
      owned: (
        <TaskChip
          dense={dense}
          label={dense ? '' : p.owned ? 'Obtained' : 'Not obtained'}
          status={p.owned ? 'DONE' : 'PENDING'}
          onToggle={() => toggle(p, 'owned', p.owned ? 'DONE' : 'PENDING')}
          title={p.owned ? 'Obtained. Click to undo' : 'Not obtained yet. Click when you have it'}
        />
      ),
      nature: p.targetNature && (
        <TaskChip dense={dense} label={natureLabel} status={p.natureStatus} onToggle={() => toggle(p, 'nature', p.natureStatus)} />
      ),
      ability: p.ability && (
        <TaskChip
          dense={dense}
          label={name(p.ability)}
          status={p.abilityStatus}
          onToggle={() => toggle(p, 'ability', p.abilityStatus)}
          warning={p.abilityLegal === false ? `${name(p.species)} cannot have this ability` : undefined}
        />
      ),
      item: (p.item || p.itemNote) && (
        <TaskChip
          dense={dense}
          label={
            <span className="inline-flex items-center gap-1">
              {p.item?.spriteUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.item.spriteUrl} alt="" width={16} height={16} className="sprite -my-1" />
              )}
              {p.item ? name(p.item) : p.itemNote}
            </span>
          }
          title={p.itemNote ?? undefined}
          status={p.itemStatus}
          onToggle={() => toggle(p, 'item', p.itemStatus)}
        />
      ),
      evs: p.evs && (
        <TaskChip dense={dense} label={formatEvs(p.evs)} status={p.evStatus} onToggle={() => toggle(p, 'evs', p.evStatus)} />
      ),
      move: (slot: number) => {
        const m = p.moves.find((x) => x.slot === slot);
        if (!m) return null;
        return (
          <TaskChip
            dense={dense}
            label={m.move ? name(m.move) : m.rawName}
            accent={m.move ? TYPE_COLORS[m.move.type] : undefined}
            status={m.status}
            onToggle={() => toggle(p, `move:${slot}`, m.status)}
            warning={
              m.move == null
                ? 'This move name was not recognised. Edit the row to fix it'
                : m.legal === false
                  ? `${name(p.species)} cannot learn this move in this game`
                  : undefined
            }
          />
        );
      },
    };
  };

  if (roster.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
        <p className="text-lg font-semibold">Your roster is empty</p>
        <p className="mt-1 text-sm text-muted">Import your training spreadsheet, or add a Pokémon by name.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href={`/${gameId}/import`} className="rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg">
            Import a spreadsheet
          </Link>
          <AddBox value={adding} onChange={setAdding} onAdd={add} />
        </div>
        {error && <p className="mt-4 text-sm text-pending">{error}</p>}
        <SpeciesList options={options} lang={lang} />
      </div>
    );
  }

  return (
    <div>
      <SpeciesList options={options} lang={lang} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-sm">
          <span className="font-semibold text-done">{stats.complete}</span>
          <span className="text-muted"> of {stats.total} fully trained</span>
        </p>
        <div className="flex rounded-md border border-line text-xs">
          {(['all', 'pending', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 capitalize ${filter === f ? 'bg-surface-2 font-semibold' : 'text-muted'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex rounded-md border border-line text-xs">
          {(['cards', 'table'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 capitalize ${view === v ? 'bg-surface-2 font-semibold' : 'text-muted'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <AddBox value={adding} onChange={setAdding} onAdd={add} />
          <button
            onClick={auditTeam}
            disabled={!aiEnabled || team.busy}
            title={aiEnabled ? `Uses ${aiProvider}` : 'Add an API key to .env.local to enable AI audits'}
            className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-40"
          >
            {team.busy ? 'Auditing team…' : 'AI team audit'}
          </button>
        </div>
      </div>

      {!aiEnabled && (
        <p className="mb-3 text-xs text-muted">
          AI audits are off: no API key is configured. Move legality checks still run, since they use game data
          rather than AI.
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
            <h2 className="font-semibold">Team audit</h2>
            <button onClick={() => setTeam({ busy: false, result: null })} className="text-xs text-muted">
              Close
            </button>
          </div>
          <p>{team.result.summary}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <AuditList title="Strengths" items={team.result.strengths} />
            <AuditList title="Weaknesses" items={team.result.weaknesses} />
            <AuditList title="Suggestions" items={team.result.suggestions.map((s) => `${s.change}: ${s.reason}`)} />
          </div>
        </div>
      )}

      {view === 'cards' ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map((p) => {
              const prog = progressOf(p);
              const c = chips(p, false);
              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={`flex flex-col rounded-xl border bg-surface p-3 transition-colors ${
                    prog.complete ? 'border-done/60 shadow-[0_0_0_1px_var(--color-done)]' : 'border-pending/40'
                  }`}
                >
                  <div className="flex gap-3">
                    <CardSprite p={p} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{p.nickname ?? name(p.species)}</h3>
                          <p className="truncate text-xs text-muted">
                            {p.nickname ? `${name(p.species)} · ` : ''}
                            {p.baseSpecies ? `from ${name(p.baseSpecies)}` : ''}
                            {p.origin !== 'UNKNOWN' ? ` · ${p.origin === 'BRED' ? 'bred' : 'caught'}` : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold ${prog.complete ? 'text-done' : 'text-pending'}`}>
                          {prog.complete ? '★ Ready' : `${prog.done}/${prog.total}`}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.types.map((t) => (
                          <TypeBadge key={t} type={t} lang={lang} small />
                        ))}
                        {p.teraType && (
                          <span className="rounded border border-line px-1 text-[9px] uppercase leading-4 text-muted">
                            Tera {p.teraType}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <motion.div
                          className={`h-full rounded-full ${prog.complete ? 'bg-done' : 'bg-pending'}`}
                          animate={{ width: `${(prog.done / prog.total) * 100}%` }}
                          transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.owned}
                    {c.nature}
                    {c.ability}
                    {c.item}
                    {c.evs}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {[1, 2, 3, 4].map((slot) => (
                      <div key={slot} className="min-w-0">
                        {c.move(slot) ?? <span className="block rounded-md border border-dashed border-line px-2 py-1 text-xs text-muted">—</span>}
                      </div>
                    ))}
                  </div>

                  {p.notes && <p className="mt-2 whitespace-pre-line text-xs text-muted">{p.notes}</p>}

                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-2 text-xs">
                    <button
                      onClick={() => (p.audit ? setOpenAudit(openAudit === p.id ? null : p.id) : audit(p))}
                      disabled={(!aiEnabled && !p.audit) || auditing === p.id}
                      className="rounded-md border border-line px-2 py-1 disabled:opacity-40"
                    >
                      {auditing === p.id ? 'Auditing…' : p.audit ? (openAudit === p.id ? 'Hide audit' : 'Show audit') : 'AI audit'}
                    </button>
                    <button
                      onClick={() => {
                        setView('table');
                        setEditing(p.id);
                      }}
                      className="rounded-md border border-line px-2 py-1"
                    >
                      Edit
                    </button>
                    <button onClick={() => remove(p)} className="ml-auto text-muted hover:text-red-400">
                      Remove
                    </button>
                  </div>

                  {openAudit === p.id && p.audit && (
                    <AuditPanel
                      audit={p.audit.result as BuildAudit}
                      meta={`${p.audit.provider} · ${p.audit.model}`}
                      onRefresh={aiEnabled ? () => audit(p, true) : undefined}
                      busy={auditing === p.id}
                    />
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-surface-2 uppercase text-muted">
              <tr>
                {['', 'Pokémon', 'Nature', 'Ability', 'Item', 'EVs', 'Move 1', 'Move 2', 'Move 3', 'Move 4', '', ''].map(
                  (h, i) => (
                    <th key={i} className="whitespace-nowrap px-2 py-2 font-medium">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                if (editing === p.id) {
                  return (
                    <RosterRowEditor
                      key={p.id}
                      pokemon={p}
                      options={options}
                      lang={lang}
                      onSave={(set) => saveEdit(p.id, set)}
                      onCancel={() => setEditing(null)}
                    />
                  );
                }
                const prog = progressOf(p);
                const c = chips(p, true);
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-line ${prog.complete ? 'bg-done/5' : ''}`}
                    style={{ boxShadow: `inset 3px 0 0 var(${prog.complete ? '--color-done' : '--color-pending'})` }}
                  >
                    <td className="py-1 pl-3 pr-1">{c.owned}</td>
                    <td className="whitespace-nowrap px-2 py-1 font-medium">
                      {p.nickname ?? name(p.species)}
                      {p.baseSpecies && <span className="ml-1 font-normal text-muted">({name(p.baseSpecies)})</span>}
                    </td>
                    <td className="px-2 py-1">{c.nature}</td>
                    <td className="px-2 py-1">{c.ability}</td>
                    <td className="max-w-40 px-2 py-1">{c.item}</td>
                    <td className="px-2 py-1">{c.evs}</td>
                    {[1, 2, 3, 4].map((slot) => (
                      <td key={slot} className="max-w-36 px-2 py-1">
                        {c.move(slot)}
                      </td>
                    ))}
                    <td className={`whitespace-nowrap px-2 py-1 font-semibold ${prog.complete ? 'text-done' : 'text-pending'}`}>
                      {prog.complete ? '★' : `${prog.done}/${prog.total}`}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-right">
                      <button onClick={() => setEditing(p.id)} className="rounded border border-line px-2 py-0.5">
                        Edit
                      </button>
                      <button onClick={() => remove(p)} aria-label="Remove" className="ml-1 px-1 text-muted hover:text-red-400">
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddBox({ value, onChange, onAdd }: { value: string; onChange: (v: string) => void; onAdd: () => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd();
      }}
      className="flex gap-1"
    >
      <input
        list="species-list"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add Pokémon…"
        aria-label="Add a Pokémon by name"
        className="w-40 rounded-md border border-line bg-surface px-2 py-1.5 text-xs placeholder:text-muted"
      />
      <button disabled={!value.trim()} className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-40">
        Add
      </button>
    </form>
  );
}

function SpeciesList({ options, lang }: { options: EditorOptions; lang: Lang }) {
  return (
    <datalist id="species-list">
      {options.species.map((s) => (
        <option key={s.id} value={lang === 'en' ? s.nameEn : s.nameEs} />
      ))}
    </datalist>
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
