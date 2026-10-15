'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/translate-client';

/** Switches between the breeding plans and the Pokémon kept to breed with, which share one menu entry. */
export function BreedingSwitch({ gameId }: { gameId: string }) {
  const { t } = useT();
  const pathname = usePathname();
  const views = [
    { href: `/${gameId}/breeding`, label: t('Plans') },
    { href: `/${gameId}/breeders`, label: t('Breeders') },
  ];
  return (
    // Stays under the menu while the page scrolls, like the roster's List / Team switch.
    <div className="-mx-4 mb-3 flex items-center gap-3 bg-bg/95 px-4 py-2 backdrop-blur md:sticky md:top-[var(--nav-h)] md:z-30">
    <nav className="ml-auto inline-flex rounded-md border border-line text-sm" aria-label={t('View')}>
      {views.map((v) => {
        const on = pathname.startsWith(v.href);
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={on ? 'page' : undefined}
            className={`px-4 py-1.5 ${on ? 'bg-surface-2 font-semibold' : 'text-muted hover:text-ink'}`}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
    </div>
  );
}
