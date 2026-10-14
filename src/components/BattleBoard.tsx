'use client';

import { useEffect, useState } from 'react';
import { ConfirmDialog } from './Dialog';
import { Sprite } from './Sprite';
import { TypeBadge } from './TypeBadge';
import { ComboInput } from './roster/parts';
import type { BattleOpponentView, CounterView, MoveView } from '@/lib/battle/load';
import type { Lang } from '@/lib/i18n';
import { TYPE_NAMES_ES as TYPE_LABEL_ES } from '@/lib/pokemon-types';
import { useT } from '@/lib/translate-client';

type Named = { id: number; nameEn: string; nameEs: string };
type FormOption = {
  id: number;
  slug: string;
  isDefault: boolean;
  types: string[];
  spriteUrl: string | null;
  abilities: (Named & { isHidden: boolean })[];
};

/** What the form edits. `id` is set when an existing opponent is being changed. */
type Draft = {
  id: string | null;
  species: string;
  formId: number | null;
  kind: 'RAID' | 'STANDARD';
  teraType: string;
  stars: string;
  abilityId: number | null;
  label: string;
  notes: string;
};

const EMPTY: Draft = {
  id: null,
  species: '',
  formId: null,
  kind: 'RAID',
  teraType: '',
  stars: '',
  abilityId: null,
  label: '',
  notes: '',
};

const inputClass = 'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm placeholder:text-muted';

export function BattleBoard({
  gameId,
  initial,
  species,
  types,
  features,
  lang,
}: {
  gameId: string;
  initial: BattleOpponentView[];
  species: Named[];
  types: string[];
  features: { raids: boolean; tera: boolean };
  lang: Lang;
}) {
  const { t } = useT();
  const [opponents, setOpponents] = useState(initial);
  const [draft, setDraftState] = useState<Draft | null>(null);
  /** A new key per opening, so the form starts from the values it was opened with. */
  const [draftKey, setDraftKey] = useState(0);
  const setDraft = (d: Draft | null) => {
    setDraftState(d);
    setDraftKey((k) => k + 1);
  };
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<BattleOpponentView | null>(null);
  /** Cards that are expanded; the newest one starts open, the rest collapsed. */
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(initial.filter((o) => !o.archived).slice(0, 1).map((o) => o.id))
  );
  /** Opponents being worked out again; "all" while every one is. */
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const active = opponents.filter((o) => !o.archived);
  const archived = opponents.filter((o) => o.archived);
  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const name = (x: Named) => (lang === 'en' ? x.nameEn : x.nameEs);
  const typeName = (type: string) => <TypeBadge key={type} type={type} lang={lang} />;

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

  function draftOf(o: BattleOpponentView, mode: 'edit' | 'clone'): Draft {
    return {
      id: mode === 'edit' ? o.id : null,
      species: name(o.species),
      formId: o.formId,
      kind: o.kind,
      teraType: o.teraType ?? '',
      stars: o.stars != null ? String(o.stars) : '',
      abilityId: o.ability?.id ?? null,
      label: o.label ?? '',
      notes: o.notes ?? '',
    };
  }

  async function save(d: Draft, speciesId: number, defaultFormId: number | null) {
    setBusy(true);
    setError(null);
    const body = {
      speciesId,
      // The default form is stored as "no form" so it follows the species.
      formId: d.formId != null && d.formId !== defaultFormId ? d.formId : null,
      kind: features.raids ? d.kind : 'STANDARD',
      teraType: features.tera && d.teraType ? d.teraType : null,
      stars: features.raids && d.kind === 'RAID' && d.stars ? Number(d.stars) : null,
      abilityId: d.abilityId,
      label: d.label.trim() || null,
      notes: d.notes.trim() || null,
    };
    try {
      if (d.id) {
        const data = await api<{ opponent: BattleOpponentView }>(`/api/battle/${d.id}`, 'PATCH', body);
        setOpponents((prev) => prev.map((o) => (o.id === d.id ? data.opponent : o)));
      } else {
        const data = await api<{ opponent: BattleOpponentView }>('/api/battle', 'POST', { gameId, ...body });
        setOpponents((prev) => [data.opponent, ...prev]);
        setOpenIds((prev) => new Set(prev).add(data.opponent.id));
      }
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not save that opponent. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(o: BattleOpponentView) {
    setDeleting(null);
    try {
      await api(`/api/battle/${o.id}`, 'DELETE');
      setOpponents((prev) => prev.filter((x) => x.id !== o.id));
    } catch {
      setError(t('Could not delete that opponent. Try again.'));
    }
  }

  /** Works the counters out again, e.g. after the roster changed. */
  async function refresh(ids: string[]) {
    setError(null);
    setRefreshing((prev) => new Set([...prev, ...ids]));
    try {
      const results = await Promise.all(
        ids.map((id) => api<{ opponent: BattleOpponentView }>(`/api/battle/${id}`, 'GET').then((r) => r.opponent))
      );
      setOpponents((prev) => prev.map((o) => results.find((r) => r.id === o.id) ?? o));
    } catch {
      setError(t('Could not refresh. Try again.'));
    } finally {
      setRefreshing((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    }
  }

  async function setArchived(o: BattleOpponentView, value: boolean) {
    setError(null);
    try {
      const data = await api<{ opponent: BattleOpponentView }>(`/api/battle/${o.id}`, 'PATCH', { archived: value });
      setOpponents((prev) => prev.map((x) => (x.id === o.id ? data.opponent : x)));
      setOpenIds((prev) => {
        const next = new Set(prev);
        next.delete(o.id);
        return next;
      });
    } catch {
      setError(t('Could not archive that opponent. Try again.'));
    }
  }

  const multLabel = (m: number) => (m === 0 ? t('immune') : `×${m}`);

  const moveLine = (m: MoveView & { multiplier: number; stab: boolean; known: boolean }) => (
    <span>
      <span className="font-medium">{name(m)}</span>{' '}
      <TypeBadge type={m.type} lang={lang} small />{' '}
      <span className="text-muted">
        {m.power} · {multLabel(m.multiplier)}
        {m.stab ? ` · ${t('same type')}` : ''}
      </span>
    </span>
  );

  const renderCounter = (c: CounterView) => (
    <li key={`${c.source}-${c.formId}`} className="flex gap-2 rounded-lg border border-line p-2 text-xs">
      <Sprite src={c.spriteUrl} alt={name(c.species)} size={44} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold">
          {c.nickname ? `${c.nickname} (${name(c.species)})` : name(c.species)}
          {c.types.map((ty) => (
            <TypeBadge key={ty} type={ty} lang={lang} small />
          ))}
          <span
            className={`rounded px-1 text-[10px] font-medium ${
              c.have ? 'bg-done/15 text-done' : 'bg-pending/15 text-pending'
            }`}
          >
            {c.source === 'roster' ? t('in your box') : c.have ? t('you have it') : t('not caught yet')}
          </span>
        </p>
        <p>
          {t('Use')} {moveLine(c.move)}
          <span className={c.move.known ? 'ml-1 text-done' : 'ml-1 text-star'}>
            {c.move.known ? t('knows it') : c.source === 'roster' ? t('can learn it') : t('learns it')}
          </span>
        </p>
        {c.alternatives.length > 0 && (
          <p className="text-muted">
            {t('Also')}: {c.alternatives.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ', '}
                {name(a)} <TypeBadge type={a.type} lang={lang} small />
              </span>
            ))}
          </p>
        )}
        {c.incoming >= 2 && <p className="text-pending">{t('Weak to its attacks ({mult})', { mult: multLabel(c.incoming) })}</p>}
        {c.incoming < 1 && <p className="text-done">{c.incoming === 0 ? t('Immune to its attacks') : t('Resists its attacks')}</p>}
      </div>
    </li>
  );

  const renderOpponent = (o: BattleOpponentView) => {
    const groups: { label: string; items: typeof o.weaknesses; tone: string }[] = [
      { label: t('Very weak (×4)'), items: o.weaknesses.filter((w) => w.multiplier >= 4), tone: 'text-done' },
      { label: t('Weak (×2)'), items: o.weaknesses.filter((w) => w.multiplier === 2), tone: 'text-done' },
      { label: t('Resists (×0.5)'), items: o.weaknesses.filter((w) => w.multiplier === 0.5), tone: 'text-pending' },
      { label: t('Resists a lot (×0.25)'), items: o.weaknesses.filter((w) => w.multiplier > 0 && w.multiplier <= 0.25), tone: 'text-pending' },
      { label: t('Immune (×0)'), items: o.weaknesses.filter((w) => w.multiplier === 0), tone: 'text-pending' },
    ].filter((g) => g.items.length > 0);

    return (
      <details key={o.id} open={openIds.has(o.id)} className="rounded-xl border border-line bg-surface">
        <summary
          onClick={(e) => {
            // The open state lives in React so "collapse all" works; the browser must not toggle it too.
            e.preventDefault();
            toggleOpen(o.id);
          }}
          className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-3"
        >
          <span aria-hidden="true" className={`text-xs text-muted transition-transform ${openIds.has(o.id) ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <Sprite src={o.spriteUrl} alt={name(o.species)} size={56} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
              {name(o.species)}
              {!o.isDefaultForm && (
                <span className="text-xs font-normal text-muted">({o.formSlug.split('-').slice(1).join(' ')})</span>
              )}
              {o.types.map((ty) => typeName(ty))}
              {o.kind === 'RAID' && (
                <span className="rounded bg-star/20 px-1.5 text-[11px] font-semibold text-star">
                  {o.stars ? t('Raid {n}★', { n: o.stars }) : t('Raid')}
                </span>
              )}
              {o.teraType && (
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  {t('Tera')} {typeName(o.teraType)}
                </span>
              )}
            </p>
            <p className="text-xs text-muted">
              {[o.label, o.ability ? `${t('Ability')}: ${name(o.ability)}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div
            className="flex gap-1.5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              disabled={refreshing.has(o.id)}
              title={t('Work out the counters again, for example after adding Pokémon to your roster')}
              onClick={() => refresh([o.id])}
              className="rounded border border-line px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-40"
            >
              {refreshing.has(o.id) ? t('Refreshing…') : t('Refresh')}
            </button>
            <button
              type="button"
              title={o.archived ? undefined : t('Put it away so it is not shown open; you can bring it back')}
              onClick={() => setArchived(o, !o.archived)}
              className="rounded border border-line px-2 py-1 text-xs hover:bg-surface-2"
            >
              {o.archived ? t('Restore') : t('Archive')}
            </button>
            <button
              type="button"
              onClick={() => setDraft(draftOf(o, 'edit'))}
              className="rounded border border-line px-2 py-1 text-xs hover:bg-surface-2"
            >
              {t('Edit')}
            </button>
            <button
              type="button"
              title={t('Make a copy to change something, like the Tera type, without losing this one')}
              onClick={() => setDraft(draftOf(o, 'clone'))}
              className="rounded border border-line px-2 py-1 text-xs hover:bg-surface-2"
            >
              {t('Clone')}
            </button>
            <button
              type="button"
              onClick={() => setDeleting(o)}
              className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-pending"
            >
              {t('Delete')}
            </button>
          </div>
        </summary>

        <div className="space-y-4 border-t border-line p-3">
          {o.notes && <p className="text-xs text-muted">{o.notes}</p>}
          {o.teraType && (
            <p className="text-xs text-muted">
              {t('Terastallized: it defends as a {type} type only.', {
                type: lang === 'es' ? (TYPE_LABEL_ES[o.teraType] ?? o.teraType) : o.teraType,
              })}
            </p>
          )}

          <section>
            <h3 className="mb-1 text-sm font-semibold">{t('Type matchups against it')}</h3>
            {groups.length === 0 ? (
              <p className="text-xs text-muted">{t('Every type does normal damage to it.')}</p>
            ) : (
              <div className="space-y-1">
                {groups.map((g) => (
                  <p key={g.label} className="flex flex-wrap items-center gap-1 text-xs">
                    <span className={`w-36 font-medium ${g.tone}`}>{g.label}</span>
                    {g.items.map((w) => typeName(w.type))}
                  </p>
                ))}
              </div>
            )}
          </section>

          {o.strongMoves.length > 0 && (
            <section>
              <h3 className="mb-1 text-sm font-semibold">{t('Strongest moves against it')}</h3>
              <ul className="space-y-1 text-xs">
                {o.strongMoves.map((g) => (
                  <li key={g.type} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="flex w-24 items-center gap-1">
                      {typeName(g.type)} <span className="text-muted">{multLabel(g.multiplier)}</span>
                    </span>
                    {g.moves.map((m, i) => (
                      <span key={m.id}>
                        {i > 0 && <span className="text-muted">· </span>}
                        {name(m)} <span className="text-muted">{m.power}</span>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-1 text-sm font-semibold">{t('From your roster')}</h3>
            {o.roster.length === 0 ? (
              <p className="text-xs text-muted">
                {t('Nothing in your roster can hit it well. Add Pokémon to your roster, or look at the suggestions below.')}
              </p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">{o.roster.map(renderCounter)}</ul>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">{t('Other good picks in this game')}</h3>
            {o.suggestions.length === 0 ? (
              <p className="text-xs text-muted">{t('No suggestions: this game has no Pokémon that can hit it well.')}</p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">{o.suggestions.map(renderCounter)}</ul>
            )}
          </section>
        </div>
      </details>
    );
  };

  return (
    <div>
      {draft ? (
        <OpponentForm
          key={draftKey}
          gameId={gameId}
          draft={draft}
          species={species}
          types={types}
          features={features}
          lang={lang}
          busy={busy}
          onCancel={() => setDraft(null)}
          onSave={save}
        />
      ) : (
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY, kind: features.raids ? 'RAID' : 'STANDARD' })}
          className="mb-6 rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg"
        >
          {t('Add opponent')}
        </button>
      )}
      {error && <p className="mb-4 text-sm text-pending">{error}</p>}

      {opponents.length === 0 ? (
        <p className="text-sm text-muted">{t('No opponents yet. Add the Pokémon you have to beat.')}</p>
      ) : (
        <div>
          {active.length > 0 && (
            <div className="mb-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={refreshing.size > 0}
                onClick={() => refresh(active.map((o) => o.id))}
                className="rounded border border-line px-2 py-1 text-muted hover:text-ink disabled:opacity-40"
              >
                {refreshing.size > 0 ? t('Refreshing…') : t('Refresh all')}
              </button>
              <button
                type="button"
                onClick={() => setOpenIds(new Set(active.map((o) => o.id)))}
                className="rounded border border-line px-2 py-1 text-muted hover:text-ink"
              >
                {t('Expand all')}
              </button>
              <button
                type="button"
                onClick={() => setOpenIds(new Set())}
                className="rounded border border-line px-2 py-1 text-muted hover:text-ink"
              >
                {t('Collapse all')}
              </button>
            </div>
          )}
          <div className="space-y-3">{active.map(renderOpponent)}</div>
          {archived.length > 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="mb-2 text-xs font-medium text-muted hover:text-ink"
              >
                {showArchived ? '▼' : '▶'} {t('Archived ({n})', { n: archived.length })}
              </button>
              {showArchived && <div className="space-y-3">{archived.map(renderOpponent)}</div>}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleting != null}
        title={t('Delete this opponent?')}
        confirmLabel={t('Delete')}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
      >
        {t('It is removed from your list. Its counters are worked out from the game data, so nothing else is lost.')}
      </ConfirmDialog>
    </div>
  );
}

function OpponentForm({
  gameId,
  draft: initial,
  species,
  types,
  features,
  lang,
  busy,
  onCancel,
  onSave,
}: {
  gameId: string;
  draft: Draft;
  species: Named[];
  types: string[];
  features: { raids: boolean; tera: boolean };
  lang: Lang;
  busy: boolean;
  onCancel: () => void;
  onSave: (d: Draft, speciesId: number, defaultFormId: number | null) => void;
}) {
  const { t } = useT();
  const [d, setD] = useState(initial);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [loadError, setLoadError] = useState(false);
  const name = (x: Named) => (lang === 'en' ? x.nameEn : x.nameEs);
  const text = d.species.trim().toLowerCase();
  const chosen = species.find((s) => s.nameEn.toLowerCase() === text || s.nameEs.toLowerCase() === text);
  const speciesId = chosen?.id ?? null;
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  // The forms and abilities of the chosen Pokémon.
  useEffect(() => {
    if (speciesId == null) return;
    const controller = new AbortController();
    fetch(`/api/battle/options?gameId=${encodeURIComponent(gameId)}&speciesId=${speciesId}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { forms: FormOption[] }) => {
        setLoadError(false);
        setForms(data.forms);
        setD((prev) => {
          const keep = data.forms.find((f) => f.id === prev.formId) ?? data.forms[0];
          const ability = keep?.abilities.some((a) => a.id === prev.abilityId) ? prev.abilityId : null;
          return { ...prev, formId: keep?.id ?? null, abilityId: ability };
        });
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setLoadError(true);
      });
    return () => controller.abort();
  }, [speciesId, gameId]);

  const form = forms.find((f) => f.id === d.formId) ?? forms[0];
  const defaultFormId = forms.find((f) => f.isDefault)?.id ?? null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (speciesId != null) onSave(d, speciesId, defaultFormId);
      }}
      className="mb-6 rounded-xl border border-line bg-surface p-4"
    >
      <h2 className="mb-3 text-sm font-semibold">
        {d.id ? t('Edit opponent') : initial.species ? t('New opponent (copy)') : t('New opponent')}
      </h2>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">{t('Pokémon')}</span>
          <ComboInput
            list="battle-species"
            value={d.species}
            onChange={(v) => set({ species: v })}
            placeholder={t('e.g. Charizard')}
            required
            className={inputClass}
          />
        </label>

        {features.raids && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t('Battle')}</span>
            <select value={d.kind} onChange={(e) => set({ kind: e.target.value as Draft['kind'] })} className={inputClass}>
              <option value="RAID">{t('Raid boss')}</option>
              <option value="STANDARD">{t('Other battle')}</option>
            </select>
          </label>
        )}

        {features.tera && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t('Tera type')}</span>
            <select value={d.teraType} onChange={(e) => set({ teraType: e.target.value })} className={inputClass}>
              <option value="">{t('Not Terastallized')}</option>
              {types.map((ty) => (
                <option key={ty} value={ty}>
                  {lang === 'es' ? (TYPE_LABEL_ES[ty] ?? ty) : ty}
                </option>
              ))}
            </select>
          </label>
        )}

        {features.raids && d.kind === 'RAID' && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t('Stars')}</span>
            <select value={d.stars} onChange={(e) => set({ stars: e.target.value })} className={inputClass}>
              <option value="">{t('Not set')}</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}★
                </option>
              ))}
            </select>
          </label>
        )}

        {forms.length > 1 && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t('Form')}</span>
            <select
              value={form?.id ?? ''}
              onChange={(e) => set({ formId: Number(e.target.value), abilityId: null })}
              className={inputClass}
            >
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.isDefault ? t('Normal') : f.slug.split('-').slice(1).join(' ')} ({f.types.join(' / ')})
                </option>
              ))}
            </select>
          </label>
        )}

        {form && form.abilities.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t('Ability (optional)')}</span>
            <select
              value={d.abilityId ?? ''}
              onChange={(e) => set({ abilityId: e.target.value ? Number(e.target.value) : null })}
              className={inputClass}
            >
              <option value="">{t('Not set')}</option>
              {form.abilities.map((a) => (
                <option key={a.id} value={a.id}>
                  {name(a)}
                  {a.isHidden ? ` (${t('hidden')})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted">{t('Name for this opponent (optional)')}</span>
          <input
            value={d.label}
            maxLength={80}
            onChange={(e) => set({ label: e.target.value })}
            placeholder={t('e.g. Wednesday 7★ raid')}
            className={inputClass}
          />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted">{t('Notes (optional)')}</span>
          <input value={d.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} className={inputClass} />
        </label>
      </div>

      {d.species.trim() && speciesId == null && (
        <p className="mt-2 text-xs text-pending">
          {t('"{name}" is not a Pokémon. Pick one from the suggestions.', { name: d.species })}
        </p>
      )}
      {loadError && <p className="mt-2 text-xs text-pending">{t('Could not load the forms for that Pokémon. Try again.')}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy || speciesId == null}
          className="rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
        >
          {busy ? t('Saving…') : d.id ? t('Save changes') : t('Add opponent')}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-line px-4 py-2 text-sm">
          {t('Cancel')}
        </button>
      </div>
      <datalist id="battle-species">
        {species.map((s) => (
          <option key={s.id} value={name(s)} label={lang === 'en' ? s.nameEs : s.nameEn} />
        ))}
      </datalist>
    </form>
  );
}
