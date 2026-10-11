import { TYPE_COLORS, TYPE_NAMES_ES } from '@/lib/pokemon-types';
import type { Lang } from '@/lib/i18n';

export function TypeBadge({ type, lang = 'en', small = false }: { type: string; lang?: Lang; small?: boolean }) {
  const label = lang === 'es' ? (TYPE_NAMES_ES[type] ?? type) : type;
  return (
    <span
      className={`inline-block rounded font-semibold uppercase tracking-wide text-white ${
        small ? 'px-1 text-[9px] leading-4' : 'px-1.5 text-[10px] leading-5'
      }`}
      style={{ background: TYPE_COLORS[type] ?? '#666', textShadow: '0 1px 1px rgb(0 0 0 / 0.4)' }}
    >
      {label}
    </span>
  );
}
