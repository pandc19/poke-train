'use client';

import { evTotal, type EvSpread } from '@/lib/import/evs';
import { useT } from '@/lib/translate-client';

/** The order the Spanish game lists the stats in: PS, Ataque, Defensa, Velocidad, Def. Esp., At. Esp. */
const ORDER = ['hp', 'attack', 'defense', 'speed', 'specialDefense', 'specialAttack'] as const;

const LABELS: Record<(typeof ORDER)[number], { en: string; es: string }> = {
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

/**
 * Six boxes for an EV spread, one per stat. `onCommit` fires when focus leaves
 * the whole group (not between boxes), so a card can save once you are done.
 */
export function EvInputs({
  value,
  onChange,
  onCommit,
}: {
  value: EvSpread | null;
  onChange: (next: EvSpread) => void;
  onCommit?: () => void;
}) {
  const { t, lang } = useT();
  const evs = value ?? NO_EVS;
  const total = evTotal(evs);
  const valid = evsAreValid(evs);

  return (
    <div
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onCommit?.();
      }}
    >
      <div className="grid grid-cols-3 gap-1.5">
        {ORDER.map((key) => (
          <label key={key} className="block min-w-0">
            <span className="block truncate text-[10px] text-muted">{LABELS[key][lang]}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={252}
              placeholder="0"
              value={evs[key] || ''}
              onChange={(e) => onChange({ ...evs, [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              aria-label={LABELS[key][lang]}
              className={`w-full rounded border bg-bg px-1 py-0.5 text-xs ${
                evs[key] > 252 ? 'border-pending text-pending' : 'border-line'
              }`}
            />
          </label>
        ))}
      </div>
      <p className={`mt-1 text-[11px] ${valid ? 'text-muted' : 'text-pending'}`}>
        {t('Total {total} / 510', { total })}
        {!valid && ` · ${t('Max 252 per stat and 510 in total.')}`}
      </p>
    </div>
  );
}
