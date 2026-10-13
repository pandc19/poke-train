'use client';

import { useT } from '@/lib/translate-client';

/** A small mark for anything an AI wrote, so it is never mistaken for game data or for what the player decided. */
export function AiBadge({ className = '' }: { className?: string }) {
  const { t } = useT();
  return (
    <span
      title={t('Written by AI')}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-star/40 bg-star/10 px-1.5 py-px align-middle text-[10px] font-semibold normal-case leading-none text-star ${className}`}
    >
      <span aria-hidden>✨</span>
      {t('AI')}
    </span>
  );
}
