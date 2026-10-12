'use client';

import { evTotal, type EvSpread } from '@/lib/import/evs';
import { useT } from '@/lib/translate-client';

/** The order the Spanish game lists the stats in: PS, Ataque, Defensa, Velocidad, Def. Esp., At. Esp. */
export const STAT_ORDER = ['hp', 'attack', 'defense', 'speed', 'specialDefense', 'specialAttack'] as const;

export const STAT_LABELS: Record<(typeof STAT_ORDER)[number], { en: string; es: string }> = {
  hp: { en: 'HP', es: 'PS' },
  attack: { en: 'Attack', es: 'Ataque' },
  defense: { en: 'Defense', es: 'Defensa' },
  speed: { en: 'Speed', es: 'Velocidad' },
  specialDefense: { en: 'Sp. Def.', es: 'Def. Esp.' },
  specialAttack: { en: 'Sp. Atk.', es: 'At. Esp.' },
};

export const NO_EVS: EvSpread = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };

/** More than 252 in a stat or 510 in total is not possible in the games. */
export const evsAreValid = (evs: EvSpread): boolean =>
  evTotal(evs) <= 510 && Object.values(evs).every((n) => n >= 0 && n <= 252);

export const cleanNumber = (raw: string): number => Math.max(0, Math.floor(Number(raw) || 0));

/**
 * Six number boxes, one per stat, in the order the game lists them.
 * `onCommit` fires when focus leaves the whole group (not between boxes).
 * Used for the stats the game shows.
 */
export function StatInputs({
  value,
  onChange,
  onCommit,
  max,
}: {
  value: EvSpread | null;
  onChange: (next: EvSpread) => void;
  onCommit?: () => void;
  /** A number above this is flagged. */
  max?: number;
}) {
  const { lang } = useT();
  const stats = value ?? NO_EVS;
  return (
    <div
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onCommit?.();
      }}
      className="grid grid-cols-3 gap-1.5"
    >
      {STAT_ORDER.map((key) => (
        <label key={key} className="block min-w-0">
          <span className="block truncate text-[10px] text-muted">{STAT_LABELS[key][lang]}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={stats[key] || ''}
            onChange={(e) => onChange({ ...stats, [key]: cleanNumber(e.target.value) })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label={STAT_LABELS[key][lang]}
            className={`w-full rounded border bg-bg px-1 py-0.5 text-xs ${
              max != null && stats[key] > max ? 'border-pending text-pending' : 'border-line'
            }`}
          />
        </label>
      ))}
    </div>
  );
}
