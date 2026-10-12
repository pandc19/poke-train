'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { POTENTIAL_LEVELS, potentialLevel } from '@/lib/potential';
import type { RosterView } from '@/lib/roster';
import { rosterProgress, type TaskKey, type TaskStatus } from '@/lib/roster-status';
import { useT } from '@/lib/translate-client';

export type Gender = RosterView['gender'];

export const progressOf = (p: RosterView) =>
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
export function withTask(p: RosterView, key: TaskKey, status: TaskStatus): RosterView {
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
export function TaskToggle({
  status,
  onToggle,
  label,
  warning,
  accent,
  title,
}: {
  status: TaskStatus;
  onToggle: () => void;
  /** Text next to the tick. Leave out for a bare tick. */
  label?: React.ReactNode;
  warning?: string;
  accent?: string;
  title?: string;
}) {
  const { t } = useT();
  const done = status === 'DONE';
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.94 }}
      aria-pressed={done}
      title={warning ?? title ?? (done ? t('Done. Click to mark pending') : t('Pending. Click to mark done'))}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
        done
          ? 'border-done/50 bg-done/15 text-done'
          : 'border-pending/50 bg-pending/10 text-pending hover:bg-pending/20'
      }`}
      style={accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : undefined}
    >
      <span aria-hidden className="text-[11px]">
        {done ? '✓' : '○'}
      </span>
      {label != null && <span className="truncate">{label}</span>}
      {warning && (
        <span aria-label={warning} className="text-red-400">
          ⚠
        </span>
      )}
    </motion.button>
  );
}

/** ♂ / ♀ toggles; both on means "I have both". Fixed for single-gender and genderless species. */
export function GenderControl({ p, onChange }: { p: RosterView; onChange: (g: Gender) => void }) {
  const { t } = useT();
  if (p.genderRate === -1) return <span className="text-xs text-muted">{t('Genderless')}</span>;
  if (p.genderRate === 0) return <span className="text-xs text-sky-400">♂ {t('always male')}</span>;
  if (p.genderRate === 8) return <span className="text-xs text-pink-400">♀ {t('always female')}</span>;

  const male = p.gender === 'MALE' || p.gender === 'BOTH';
  const female = p.gender === 'FEMALE' || p.gender === 'BOTH';
  const set = (m: boolean, f: boolean) => onChange(m && f ? 'BOTH' : m ? 'MALE' : f ? 'FEMALE' : 'UNKNOWN');

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-pressed={male}
        onClick={() => set(!male, female)}
        title={male ? t('You have a male. Click to remove') : t('Click if you have a male')}
        className={`h-7 w-9 rounded text-sm font-bold ${
          male ? 'bg-sky-500 text-white' : 'border border-line text-muted hover:text-sky-400'
        }`}
      >
        ♂
      </button>
      <button
        type="button"
        aria-pressed={female}
        onClick={() => set(male, !female)}
        title={female ? t('You have a female. Click to remove') : t('Click if you have a female')}
        className={`h-7 w-9 rounded text-sm font-bold ${
          female ? 'bg-pink-500 text-white' : 'border border-line text-muted hover:text-pink-400'
        }`}
      >
        ♀
      </button>
      <span className="text-[11px] text-muted">
        {male && female ? t('have both') : male ? t('male') : female ? t('female') : t('not set')}
      </span>
    </div>
  );
}

/** The Pokémon's picture: animated when one exists, a silhouette while it is not obtained. */
export function PokemonSprite({ p, size = 80, animated = true }: { p: RosterView; size?: number; animated?: boolean }) {
  const moving =
    animated && p.formId
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${p.formId}.gif`
      : null;
  const [src, setSrc] = useState(moving ?? p.spriteUrl);
  if (!src) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-surface-2 text-muted"
        style={{ width: size, height: size }}
      >
        ?
      </span>
    );
  }
  return (
    <span className="grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => src !== p.spriteUrl && setSrc(p.spriteUrl)}
        style={{ maxWidth: size, maxHeight: size }}
        className={`${p.owned ? '' : 'sprite-silhouette'} ${src === p.spriteUrl ? 'sprite' : ''}`}
      />
    </span>
  );
}

/** The Judge's verdict as a coloured select, so the colour tells you the tier at a glance. */
export function PotentialSelect({ p, onChange }: { p: RosterView; onChange: (v: RosterView['potential']) => void }) {
  const { t, lang } = useT();
  const level = potentialLevel(p.potential);
  return (
    <select
      value={p.potential ?? ''}
      onChange={(e) => onChange((e.target.value || null) as RosterView['potential'])}
      aria-label={t('Potential from the in-game Judge')}
      title={t('What the in-game Judge (Juez) says about this Pokémon')}
      className={`rounded-md border bg-surface px-2 py-1 text-xs ${level?.className ?? 'border-line text-muted'}`}
    >
      <option value="">{t('Not judged')}</option>
      {POTENTIAL_LEVELS.map((l) => (
        <option key={l.value} value={l.value}>
          {lang === 'en' ? l.label : l.labelEs}
        </option>
      ))}
    </select>
  );
}
