'use client';

import { useState } from 'react';
import { formatEvs } from '@/lib/import/evs';
import type { Lang } from '@/lib/i18n';
import { TYPE_NAMES_ES, TYPE_SLUGS } from '@/lib/pokemon-types';
import type { EditorOptions, RosterView } from '@/lib/roster';

type Named = { id: number; nameEn: string; nameEs: string };

const inputClass = 'w-full rounded border border-line bg-bg px-1.5 py-1 text-xs';

/**
 * Inline edit form for one table row. Free-text fields with suggestions
 * (moves, item) are resolved back to ids on save; an unrecognised name
 * blocks the save with a message instead of being silently dropped.
 */
export function RosterRowEditor({
  pokemon: p,
  options,
  lang,
  onSave,
  onCancel,
}: {
  pokemon: RosterView;
  options: EditorOptions;
  lang: Lang;
  /** Resolves to an error message, or null on success. */
  onSave: (set: Record<string, unknown>) => Promise<string | null>;
  onCancel: () => void;
}) {
  const label = (x: Named | null | undefined) => (x ? (lang === 'en' ? x.nameEn : x.nameEs) : '');
  const [nickname, setNickname] = useState(p.nickname ?? '');
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

  async function save() {
    const moveSet: { slot: number; moveId: number | null }[] = [];
    for (const [i, text] of moves.entries()) {
      if (!text.trim()) {
        moveSet.push({ slot: i + 1, moveId: null });
        continue;
      }
      const move = find(options.moves, text);
      if (!move) {
        setError(`Move ${i + 1}: "${text}" is not a known move. Pick one from the suggestions.`);
        return;
      }
      moveSet.push({ slot: i + 1, moveId: move.id });
    }
    const matchedItem = item.trim() ? find(options.items, item) : undefined;

    setBusy(true);
    setError(null);
    const message = await onSave({
      nickname: nickname.trim() || null,
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

  return (
    <>
      <tr className="border-t border-line bg-surface-2">
        <td />
        <td className="px-2 py-2">
          <div className="mb-1 font-medium">{label(p.species)}</div>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname" aria-label="Nickname" className={inputClass} />
        </td>
        <td className="px-2 py-2">
          <select value={natureId} onChange={(e) => setNatureId(Number(e.target.value))} aria-label="Nature" className={inputClass}>
            <option value={0}>No nature</option>
            {options.natures.map((n) => (
              <option key={n.id} value={n.id}>
                {label(n)}
                {n.increased ? ` (+${n.increased.replace('special-', 'sp. ')} −${n.decreased!.replace('special-', 'sp. ')})` : ''}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-2">
          <select value={abilityId} onChange={(e) => setAbilityId(Number(e.target.value))} aria-label="Ability" className={inputClass}>
            <option value={0}>No ability</option>
            {abilityChoices.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
                {a.isHidden ? ' (hidden)' : ''}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-2">
          <input list="items-list" value={item} onChange={(e) => setItem(e.target.value)} placeholder="Item" aria-label="Held item" className={inputClass} />
        </td>
        <td className="px-2 py-2">
          <input value={evs} onChange={(e) => setEvs(e.target.value)} placeholder="252 Atk / 252 Spe / 4 HP" aria-label="EV spread" className={inputClass} />
        </td>
        {moves.map((value, i) => (
          <td key={i} className="px-2 py-2">
            <input
              list="moves-list"
              value={value}
              onChange={(e) => setMoves((prev) => prev.map((m, k) => (k === i ? e.target.value : m)))}
              placeholder={`Move ${i + 1}`}
              aria-label={`Move ${i + 1}`}
              className={inputClass}
            />
          </td>
        ))}
        <td className="px-2 py-2">
          <select value={teraType} onChange={(e) => setTeraType(e.target.value)} aria-label="Tera type" className={inputClass}>
            <option value="">Tera</option>
            {TYPE_SLUGS.map((t) => (
              <option key={t} value={t}>
                {lang === 'es' ? TYPE_NAMES_ES[t] : t}
              </option>
            ))}
          </select>
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-right">
          <button onClick={save} disabled={busy} className="rounded bg-done px-2 py-1 font-semibold text-bg disabled:opacity-40">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onCancel} className="ml-1 rounded border border-line px-2 py-1">
            Cancel
          </button>
        </td>
      </tr>
      <tr className="bg-surface-2">
        <td />
        <td colSpan={11} className="px-2 pb-2">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" rows={2} className={inputClass} />
          {error && (
            <p role="alert" className="mt-1 text-pending">
              {error}
            </p>
          )}
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
        </td>
      </tr>
    </>
  );
}
