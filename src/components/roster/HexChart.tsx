'use client';

import type { EvSpread } from '@/lib/import/evs';

type Key = keyof EvSpread;

/** Clockwise from the top, like the game's graph. */
export const HEX_ORDER: Key[] = ['hp', 'attack', 'defense', 'speed', 'specialDefense', 'specialAttack'];

const SIZE = 200;
const C = SIZE / 2;
/** The polygon fills this share of the box, so the controls have room around it. */
const R = 62;

const angle = (i: number) => (-90 + i * 60) * (Math.PI / 180);
const point = (i: number, radius: number) => `${C + radius * Math.cos(angle(i))},${C + radius * Math.sin(angle(i))}`;

/**
 * A six-sided graph like the game's. `values` is the filled shape, `overlay` an optional dashed outline
 * (a plan to compare with). `renderControl` draws whatever sits at each corner: a label and value, arrows…
 */
export function HexChart({
  values,
  max,
  overlay,
  color,
  renderControl,
}: {
  values: EvSpread;
  /** What the outer edge stands for. */
  max: number;
  overlay?: EvSpread | null;
  /** CSS colour of the filled shape. */
  color: string;
  renderControl: (key: Key) => React.ReactNode;
}) {
  const shape = (v: EvSpread) =>
    HEX_ORDER.map((k, i) => point(i, (Math.min(Math.max(v[k], 0), max) / max) * R)).join(' ');
  const ring = (f: number) => HEX_ORDER.map((_, i) => point(i, R * f)).join(' ');

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full" aria-hidden>
        {[1, 0.66, 0.33].map((f) => (
          <polygon key={f} points={ring(f)} fill="none" stroke="currentColor" strokeOpacity={f === 1 ? 0.35 : 0.15} />
        ))}
        {HEX_ORDER.map((_, i) => (
          <line key={i} x1={C} y1={C} x2={C + R * Math.cos(angle(i))} y2={C + R * Math.sin(angle(i))} stroke="currentColor" strokeOpacity={0.15} />
        ))}
        <polygon points={shape(values)} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        {overlay && (
          <polygon points={shape(overlay)} fill="none" stroke="currentColor" strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="3 2" />
        )}
      </svg>
      {HEX_ORDER.map((key, i) => {
        const x = 50 + 43 * Math.cos(angle(i));
        const y = 50 + 43 * Math.sin(angle(i));
        return (
          <div
            key={key}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {renderControl(key)}
          </div>
        );
      })}
    </div>
  );
}
