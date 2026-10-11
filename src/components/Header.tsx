'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { motion } from 'motion/react';
import { setLang } from '@/app/actions';
import type { Lang } from '@/lib/i18n';

type GameLink = {
  id: string;
  shortName: string;
  theme: { from: string; to: string; accent: string };
  breeding: boolean;
};

// Planned modules, shown as empty cartridge slots.
const COMING_SOON = ['Legends: Z-A'];

export function Header({ games, lang }: { games: GameLink[]; lang: Lang }) {
  const pathname = usePathname();
  const params = useParams<{ game?: string }>();
  const [pending, startTransition] = useTransition();
  const current = games.find((g) => g.id === params.game) ?? games[0];

  const tabs = [
    { href: `/${current.id}/pokedex`, label: 'Pokédex' },
    { href: `/${current.id}/national`, label: 'National Dex' },
    { href: `/${current.id}/roster`, label: 'Roster' },
    { href: `/${current.id}/import`, label: 'Import' },
    ...(current.breeding ? [{ href: `/${current.id}/breeding`, label: 'Breeding' }] : []),
    { href: `/${current.id}/starter-team`, label: 'Starter team' },
  ];

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Poké<span className="text-star">Train</span>
        </Link>

        <div className="flex items-center gap-2" aria-label="Game">
          {games.map((g) => {
            const active = g.id === current.id;
            return (
              <Link key={g.id} href={`/${g.id}/pokedex`} aria-current={active ? 'page' : undefined}>
                <motion.span
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  className="relative block rounded-t-md rounded-b-sm px-3 pb-1.5 pt-2.5 text-xs font-semibold text-white shadow"
                  style={{
                    background: `linear-gradient(160deg, ${g.theme.from}, ${g.theme.to})`,
                    opacity: active ? 1 : 0.55,
                    outline: active ? `2px solid ${g.theme.accent}` : 'none',
                    outlineOffset: 2,
                  }}
                >
                  {/* cartridge notch */}
                  <span className="absolute left-1/2 top-0 h-1 w-5 -translate-x-1/2 rounded-b bg-black/40" />
                  {g.shortName}
                </motion.span>
              </Link>
            );
          })}
          {COMING_SOON.map((name) => (
            <span
              key={name}
              title="Coming soon"
              className="rounded-t-md rounded-b-sm border border-dashed border-line px-3 pb-1.5 pt-2.5 text-xs text-muted"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center rounded-md border border-line text-xs" aria-label="Name language">
          {(['es', 'en'] as const).map((l) => (
            <button
              key={l}
              disabled={pending}
              onClick={() => startTransition(() => setLang(l))}
              className={`px-2 py-1 uppercase ${lang === l ? 'bg-surface-2 font-semibold text-ink' : 'text-muted'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {(
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`relative whitespace-nowrap px-3 py-2 text-sm ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {t.label}
                {active && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded"
                    style={{ background: current.theme.accent }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
