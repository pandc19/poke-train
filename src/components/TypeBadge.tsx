import { TYPE_COLORS, TYPE_NAMES_ES } from '@/lib/pokemon-types';
import type { Lang } from '@/lib/i18n';

export function TypeBadge({ type, lang = 'en', small = false }: { type: string; lang?: Lang; small?: boolean }) {
  const label = lang === 'es' ? (TYPE_NAMES_ES[type] ?? type) : type;
  return (
    <span
      className={`inline-block rounded-[5px] font-display font-semibold uppercase tracking-wide text-white ${
        small ? 'px-1.5 text-[9px] leading-4' : 'px-2 text-[10px] leading-5'
      }`}
      style={{
        background: TYPE_COLORS[type] ?? '#666',
        textShadow: '0 1px 1px rgb(0 0 0 / 0.4)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 -2px 0 rgb(0 0 0 / 0.22)',
      }}
    >
      {label}
    </span>
  );
}

/** Corners cut to points on the left and right, like a cut gem. */
const GEM = (inset: number) =>
  `polygon(${inset}px 0, calc(100% - ${inset}px) 0, 100% 50%, calc(100% - ${inset}px) 100%, ${inset}px 100%, 0 50%)`;

/** The Tera type: the type's colour as a cut gem, with facets and a glint that sweeps across it. */
export function TeraBadge({ type, lang = 'en', title }: { type: string; lang?: Lang; title?: string }) {
  const label = lang === 'es' ? (TYPE_NAMES_ES[type] ?? type) : type;
  return (
    <span
      title={title}
      className="tera-gem inline-block px-3.5 align-middle font-display text-[10px] font-semibold uppercase leading-5 tracking-wide text-white"
      style={{
        backgroundColor: TYPE_COLORS[type] ?? '#666',
        textShadow: '0 1px 1px rgb(0 0 0 / 0.45)',
        clipPath: GEM(9),
      }}
    >
      {label}
    </span>
  );
}
