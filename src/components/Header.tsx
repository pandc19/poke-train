'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { setLang } from '@/app/actions';
import { CatalogButton } from './CatalogDialog';
import type { CatalogSection } from '@/lib/games/catalog';
import { useT } from '@/lib/translate-client';

type GameLink = {
  id: string;
  shortName: string;
  theme: { from: string; to: string; accent: string };
  breeding: boolean;
  exclusives: boolean;
  catalog: CatalogSection[];
};

// Planned modules, shown as empty cartridge slots.
const COMING_SOON = ['Legends: Z-A'];

export function Header({ games }: { games: GameLink[] }) {
  const { t, lang } = useT();
  const pathname = usePathname();
  const params = useParams<{ game?: string }>();
  const [pending, startTransition] = useTransition();
  const current = games.find((g) => g.id === params.game) ?? games[0];
  const [gamesOpen, setGamesOpen] = useState(false);
  // The section the player is in, so switching game keeps them there when that game has it.
  const section = pathname.split('/')[2] || 'pokedex';
  const sectionIn = (g: GameLink) => {
    if (section === 'exclusives') return g.exclusives ? section : 'pokedex';
    if (section === 'breeders' || section === 'breeding') return g.breeding ? section : 'pokedex';
    return ['pokedex', 'roster', 'search', 'battle', 'national'].includes(section) ? section : 'pokedex';
  };

  // The breeding pages show the breeding items; every other page shows the training ones.
  const onBreeding = /\/(breeding|breeders)(\/|$)/.test(pathname);
  const onPokedex = /\/(pokedex|national|exclusives)(\/|$)/.test(pathname);
  const catalog = onPokedex ? [] : current.catalog.filter((s) => (s.topic ?? 'training') === (onBreeding ? 'breeding' : 'training'));

  // Breeders are a view inside Breeding (see BreedingSwitch), so both pages light up its tab.
  // Exclusives and Search sit apart, on the right.
  const tabs: { href: string; label: string; also?: string; right?: boolean }[] = [
    { href: `/${current.id}/pokedex`, label: t('Pokédex') },
    { href: `/${current.id}/roster`, label: t('Roster') },
    { href: `/${current.id}/battle`, label: t('Battle') },
    ...(current.breeding
      ? [{ href: `/${current.id}/breeders`, label: t('Breeding'), also: `/${current.id}/breeding` }]
      : []),
    ...(current.exclusives ? [{ href: `/${current.id}/exclusives`, label: t('Exclusives'), right: true }] : []),
    { href: `/${current.id}/search`, label: t('Search'), right: true },
  ];
  const firstRight = tabs.findIndex((x) => x.right);

  return (
    <>
    <header className="bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-1.5 text-lg font-bold tracking-tight">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="shrink-0">
            <circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#1f2937" strokeWidth="1.5" />
            <path d="M1.5 12a10.5 10.5 0 0 1 21 0z" fill="#ef4444" stroke="#1f2937" strokeWidth="1.5" />
            <path d="M1.5 12h21" stroke="#1f2937" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="3.5" fill="#fff" stroke="#1f2937" strokeWidth="1.5" />
          </svg>
          <span>
            Poké<span className="text-star">Train</span>
          </span>
        </Link>

        <div className="flex items-center gap-2" aria-label={t('Game')}>
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
              title={t('Coming soon')}
              className="rounded-t-md rounded-b-sm border border-dashed border-line px-3 pb-1.5 pt-2.5 text-xs text-muted"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-md border border-line text-xs" aria-label={t('Language')}>
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
      </div>

    </header>
    {/* The sections stay at the top while the page scrolls; the logo, the games and the language scroll away. */}
    <div className="sticky top-0 z-40 border-y border-line bg-surface/95 backdrop-blur" style={{ height: 'var(--nav-h)' }}>
      <div className="mx-auto flex h-full max-w-7xl items-stretch gap-2 px-4">
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => setGamesOpen((v) => !v)}
            aria-expanded={gamesOpen}
            aria-label={t('Game')}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow"
            style={{ background: `linear-gradient(160deg, ${current.theme.from}, ${current.theme.to})` }}
          >
            {current.shortName}
            <span aria-hidden className="text-[9px] opacity-80">
              ▾
            </span>
          </button>
          {gamesOpen && (
            <>
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setGamesOpen(false)} />
              <ul className="absolute left-0 top-full z-50 mt-1 min-w-36 rounded-lg border border-line bg-surface p-1 shadow-lg">
                {games.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/${g.id}/${sectionIn(g)}`}
                      onClick={() => setGamesOpen(false)}
                      className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-surface-2 ${
                        g.id === current.id ? 'font-semibold' : 'text-muted'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.theme.from }} />
                      {g.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <nav aria-label={t('Sections')} className="flex flex-1 gap-1 overflow-x-auto">
          {tabs.map((tab, i) => {
            const active = pathname.startsWith(tab.href) || (tab.also != null && pathname.startsWith(tab.also));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex items-center whitespace-nowrap px-3 text-sm ${i === firstRight ? 'ml-auto' : ''} ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label}
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
      </div>
    </div>
    {catalog.length > 0 && <CatalogButton sections={catalog} />}
    </>
  );
}
