'use client';

import { useState } from 'react';
import { Dialog } from './Dialog';
import { formatEvs } from '@/lib/import/evs';
import type { Lang } from '@/lib/i18n';
import { POTENTIAL_LEVELS } from '@/lib/potential';
import { TYPE_NAMES_ES, TYPE_SLUGS } from '@/lib/pokemon-types';
import { useT } from '@/lib/translate-client';
import type { EditorOptions, RosterView } from '@/lib/roster';

type Named = { id: number; nameEn: string; nameEs: string };

/** Short stat names for the +/− shown next to a nature. */
const STAT_SHORT: Record<string, { en: string; es: string }> = {
  attack: { en: 'Atk', es: 'Atq' },
  defense: { en: 'Def', es: 'Def' },
  'special-attack': { en: 'SpA', es: 'AtEsp' },
  'special-defense': { en: 'SpD', es: 'DefEsp' },
  speed: { en: 'Spe', es: 'Vel' },
};

const inputClass = 'w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

/**
 * Edit one roster Pokémon in a modal. Free-text fields with suggestions
 * (moves, item) are resolved back to ids on save; an unrecognised name
 * blocks the save with a message instead of being silently dropped.
 */
export function RosterEditDialog({
  pokemon,
  options,
  lang,
  judge,
  onSave,
  onClose,
}: {
  pokemon: RosterView | null;
  options: EditorOptions;
  lang: Lang;
  /** The game has a Judge, so the potential can be set. */
  judge: boolean;
  /** Resolves to an error message, or null on success. */
  onSave: (id: string, set: Record<string, unknown>) => Promise<string | null>;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Dialog
      open={pokemon != null}
      onClose={onClose}
      wide
      title={pokemon ? t('Edit {name}', { name: lang === 'en' ? pokemon.species.nameEn : pokemon.species.nameEs }) : ''}
    >
      {pokemon && (
        <EditForm key={pokemon.id} p={pokemon} options={options} lang={lang} judge={judge} onSave={onSave} onClose={onClose} />
      )}
    </Dialog>
  );
}

function EditForm({
  p,
  options,
  lang,
  judge,
  onSave,
  onClose,
}: {
  p: RosterView;
  options: EditorOptions;
  lang: Lang;
  judge: boolean;
  onSave: (id: string, set: Record<string, unknown>) => Promise<string | null>;
  onClose: () => void;
}) {
  const { t } = useT();
  const label = (x: Named | null | undefined) => (x ? (lang === 'en' ? x.nameEn : x.nameEs) : '');
  const stat = (slug: string) => (STAT_SHORT[slug] ? STAT_SHORT[slug][lang] : slug);
  const [nickname, setNickname] = useState(p.nickname ?? '');
  const [gender, setGender] = useState(p.gender);
  const [potential, setPotential] = useState(p.potential ?? '');
  const [natureId, setNatureId] = useState(p.targetNature?.id ?? 0);
  const [abilityId, setAbilityId] = useState(p.ability?.id ?? 0);
  const [item, setItem] = useState(p.item ? label(p.item) : (p.itemNote ?? ''));
  const [evs, setEvs] = useState(p.evs ? formatEvs(p.evs) : '');
  const [teraType, setTeraType] = useState(p.teraType ?? '');
  const [notes, setNotes] = useState(p.notes ?? '');
  const [moves, setMoves] = useState(() =>
    [1, 2, 3, 4].map((slot) => {
      const m = p.moves.find((x) => x.slot === slot);
      return m ? (m.move ? label(m.move) : (m.rawName ?? '')) : '';
    })
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const find = (list: Named[], text: string) => {
    const t = text.trim().toLowerCase();
    return list.find((x) => x.nameEn.toLowerCase() === t || x.nameEs.toLowerCase() === t);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const moveSet: { slot: number; moveId: number | null }[] = [];
    for (const [i, text] of moves.entries()) {
      if (!text.trim()) {
        moveSet.push({ slot: i + 1, moveId: null });
        continue;
      }
      const move = find(options.moves, text);
      if (!move) {
        setError(t('Move {n}: "{name}" is not a known move. Pick one from the suggestions.', { n: i + 1, name: text }));
        return;
      }
      moveSet.push({ slot: i + 1, moveId: move.id });
    }
    const matchedItem = item.trim() ? find(options.items, item) : undefined;

    setBusy(true);
    setError(null);
    const message = await onSave(p.id, {
      nickname: nickname.trim() || null,
      gender,
      ...(judge ? { potential: potential || null } : {}),
      targetNatureId: natureId || null,
      abilityId: abilityId || null,
      itemId: matchedItem?.id ?? null,
      // Text that is not an exact item name is kept as a note ("Life Orb or Choice Band").
      itemNote: item.trim() && !matchedItem ? item.trim() : null,
      evs: evs.trim() || null,
      teraType: teraType || null,
      notes: notes.trim() || null,
      moves: moveSet,
    });
    setBusy(false);
    if (message) setError(message);
  }

  // The ability the row already has stays selectable even if the species cannot have it.
  const abilityChoices =
    p.ability && !p.abilityOptions.some((a) => a.id === p.ability!.id)
      ? [...p.abilityOptions, { ...p.ability, isHidden: false }]
      : p.abilityOptions;

  const genderChoices: { value: RosterView['gender']; label: string }[] =
    p.genderRate === -1
      ? [{ value: 'GENDERLESS', label: t('Genderless') }]
      : p.genderRate === 0
        ? [{ value: 'MALE', label: t('♂ Male (only gender)') }]
        : p.genderRate === 8
          ? [{ value: 'FEMALE', label: t('♀ Female (only gender)') }]
          : [
              { value: 'UNKNOWN', label: t('Not set') },
              { value: 'MALE', label: t('♂ Male') },
              { value: 'FEMALE', label: t('♀ Female') },
              { value: 'BOTH', label: t('♂ ♀ I have both') },
            ];

  return (
    <form onSubmit={save} className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Nickname')}>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} className={inputClass} />
        </Field>
        {judge && (
          <Field label={t('Potential (Judge)')} hint={t('What the in-game Judge (Juez) says about this Pokémon.')}>
            <select value={potential} onChange={(e) => setPotential(e.target.value as typeof potential)} className={inputClass}>
              <option value="">{t('Not judged yet')}</option>
              {POTENTIAL_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {lang === 'en' ? l.label : l.labelEs}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t('Gender')} hint={t('Used by the breeding planner to know which parents you have.')}>
          <select value={gender} onChange={(e) => setGender(e.target.value as RosterView['gender'])} className={inputClass}>
            {genderChoices.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('Build')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('Nature')} hint={t('Changing it marks the nature as pending again.')}>
            <select value={natureId} onChange={(e) => setNatureId(Number(e.target.value))} className={inputClass}>
              <option value={0}>{t('No nature planned')}</option>
              {options.natures.map((n) => (
                <option key={n.id} value={n.id}>
                  {label(n)}
                  {n.increased ? ` (+${stat(n.increased)} −${stat(n.decreased!)})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Ability')}>
            <select value={abilityId} onChange={(e) => setAbilityId(Number(e.target.value))} className={inputClass}>
              <option value={0}>{t('No ability planned')}</option>
              {abilityChoices.map((a) => (
                <option key={a.id} value={a.id}>
                  {label(a)}
                  {a.isHidden ? ` (${t('hidden')})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Held item')} hint={t('Pick from the list, or type your own note such as “Vidasfera o Cinta Elegida”.')}>
            <input list="items-list" value={item} onChange={(e) => setItem(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t('EV spread')} hint={t('For example 252 Atk / 4 SpD / 252 Spe. English or Spanish stat names work.')}>
            <input value={evs} onChange={(e) => setEvs(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t('Tera type')}>
            <select value={teraType} onChange={(e) => setTeraType(e.target.value)} className={inputClass}>
              <option value="">{t('Not planned')}</option>
              {TYPE_SLUGS.map((t) => (
                <option key={t} value={t}>
                  {lang === 'es' ? TYPE_NAMES_ES[t] : t}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('Moves')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {moves.map((value, i) => (
            <Field key={i} label={t('Move {n}', { n: i + 1 })}>
              <input
                list="moves-list"
                value={value}
                onChange={(e) => setMoves((prev) => prev.map((m, k) => (k === i ? e.target.value : m)))}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">{t('A move you change is marked pending until you tick it as learned.')}</p>
      </section>

      <Field label={t('Notes')}>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
      </Field>

      <datalist id="moves-list">
        {options.moves.map((m) => (
          <option key={m.id} value={label(m)} />
        ))}
      </datalist>
      <datalist id="items-list">
        {options.items.map((it) => (
          <option key={it.id} value={label(it)} />
        ))}
      </datalist>

      {error && (
        <p role="alert" className="rounded-md border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2 text-sm">
          {t('Cancel')}
        </button>
        <button disabled={busy} className="rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
          {busy ? t('Saving…') : t('Save')}
        </button>
      </div>
    </form>
  );
}
