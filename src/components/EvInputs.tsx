'use client';

import { useState } from 'react';
import { estimateEvs, type NatureEffect } from '@/lib/ev-estimate';
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

/** What is needed to turn the stats the game shows back into EVs. */
export type EvEstimateInfo = {
  baseStats: EvSpread;
  nature: NatureEffect;
  /** Display name of the nature that is applied, when there is one. */
  natureName: string | null;
};

const cleanNumber = (raw: string) => Math.max(0, Math.floor(Number(raw) || 0));

/**
 * Six boxes for an EV spread, one per stat. `onCommit` fires when focus leaves
 * the whole group (not between boxes), so a card can save once you are done.
 *
 * With `estimate`, a small panel turns the stat numbers the game shows (the
 * blue graph) into EVs, for when the game only draws the EVs as a graph.
 */
export function EvInputs({
  value,
  onChange,
  onCommit,
  estimate,
  estimated: wasEstimated = false,
  onEstimatedChange,
}: {
  value: EvSpread | null;
  onChange: (next: EvSpread) => void;
  /** Called once focus leaves the boxes, with whether the numbers are an estimate. */
  onCommit?: (estimated: boolean) => void;
  estimate?: EvEstimateInfo;
  /** The numbers shown were calculated from the stats earlier. */
  estimated?: boolean;
  onEstimatedChange?: (estimated: boolean) => void;
}) {
  const { t, lang } = useT();
  const evs = value ?? NO_EVS;
  const total = evTotal(evs);
  const valid = evsAreValid(evs);

  const [panelOpen, setPanelOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [level, setLevel] = useState('100');
  const [estimated, setEstimatedState] = useState(wasEstimated);
  const setEstimated = (next: boolean) => {
    setEstimatedState(next);
    onEstimatedChange?.(next);
  };

  const calculate = () => {
    if (!estimate) return;
    const numbers = Object.fromEntries(ORDER.map((k) => [k, cleanNumber(stats[k] ?? '')])) as unknown as EvSpread;
    if (evTotal(numbers) === 0) return;
    onChange(
      estimateEvs({
        stats: numbers,
        level: Math.min(100, Math.max(1, cleanNumber(level) || 100)),
        baseStats: estimate.baseStats,
        nature: estimate.nature,
      })
    );
    setEstimated(true);
    setPanelOpen(false);
  };

  const inputClass = 'w-full rounded border bg-bg px-1 py-0.5 text-xs';

  return (
    <div
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onCommit?.(estimated);
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
              onChange={(e) => {
                setEstimated(false);
                onChange({ ...evs, [key]: cleanNumber(e.target.value) });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              aria-label={LABELS[key][lang]}
              className={`${inputClass} ${evs[key] > 252 ? 'border-pending text-pending' : 'border-line'}`}
            />
          </label>
        ))}
      </div>

      <p className={`mt-1 text-[11px] ${valid ? 'text-muted' : 'text-pending'}`}>
        {t('Total {total} / 510', { total })}
        {!valid && ` · ${t('Max 252 per stat and 510 in total.')}`}
      </p>
      {!valid && estimate && (
        <p className="mt-0.5 text-[11px] text-pending">
          {t('These look like stat numbers, not EVs. Use "Type the stats from the blue graph" below.')}
        </p>
      )}
      {estimated && valid && (
        <p className="mt-0.5 text-[11px] text-star">
          {t('Estimated from the stats. Compare it with the yellow EV graph and adjust.')}
        </p>
      )}

      {estimate && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            className="text-[11px] text-muted underline hover:text-ink"
          >
            {t('No EV numbers in the game? Type the stats from the blue graph')}
          </button>
          {panelOpen && (
            <div className="mt-1.5 rounded-md border border-line bg-surface p-2">
              <p className="mb-1.5 text-[11px] text-muted">
                {t(
                  'Type the six numbers from the blue graph (the stats) and its level. The EVs are estimated assuming perfect IVs (31): if its IVs are lower, it has more EVs than this shows.'
                )}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {ORDER.map((key) => (
                  <label key={key} className="block min-w-0">
                    <span className="block truncate text-[10px] text-muted">{LABELS[key][lang]}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={stats[key] ?? ''}
                      onChange={(e) => setStats((prev) => ({ ...prev, [key]: e.target.value }))}
                      aria-label={`${LABELS[key][lang]} (${t('stat')})`}
                      className={`${inputClass} border-line`}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap items-end gap-2">
                <label className="block w-20">
                  <span className="block text-[10px] text-muted">{t('Level')}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className={`${inputClass} border-line`}
                  />
                </label>
                <button
                  type="button"
                  onClick={calculate}
                  className="rounded-md bg-done px-3 py-1 text-xs font-semibold text-bg"
                >
                  {t('Calculate EVs')}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted">
                {estimate.natureName
                  ? t('Using its {nature} nature', { nature: estimate.natureName })
                  : t('Its nature is not set, so none is applied.')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
