'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { setLang } from '@/app/actions';
import { CatalogButton } from './CatalogDialog';
import { ShellMotif } from './ShellMotif';
import { ThemeToggle } from './ThemeToggle';
import type { CatalogSection } from '@/lib/games/catalog';
import type { GameMotif } from '@/lib/games';
import { useT } from '@/lib/translate-client';

type GameLink = {
  id: string;
  shortName: string;
  theme: { from: string; to: string; accent: string; lightAccent: string; screenHue: number; motif?: GameMotif };
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

  // Breeding opens on the view (Breeders or Plans) the player was last on. Read after mount: the server
  // render has no localStorage, and Breeders is where a first visit starts.
  const [breedingView, setBreedingView] = useState<'breeders' | 'breeding'>('breeders');
  useEffect(() => {
    const here = /\/(breeding|breeders)(\/|$)/.exec(pathname)?.[1] as 'breeders' | 'breeding' | undefined;
    try {
      if (here) localStorage.setItem('breeding-view', here);
      const saved = here ?? localStorage.getItem('breeding-view');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'breeders' || saved === 'breeding') setBreedingView(saved);
    } catch {}
  }, [pathname]);

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
      ? [
          {
            href: `/${current.id}/${breedingView}`,
            label: t('Breeding'),
            also: `/${current.id}/${breedingView === 'breeders' ? 'breeding' : 'breeders'}`,
          },
        ]
      : []),
    ...(current.exclusives ? [{ href: `/${current.id}/exclusives`, label: t('Exclusives'), right: true }] : []),
    { href: `/${current.id}/search`, label: t('Search'), right: true },
  ];
  const firstRight = tabs.findIndex((x) => x.right);

  return (
    <>
    {/* The device and its screen take the game's colours (see globals.css). */}
    <style>{`:root{--shell:${current.theme.from};--shell-dark:${current.theme.to};--screen-hue:${current.theme.screenHue};--accent-dark:${current.theme.accent};--accent-light:${current.theme.lightAccent}}`}</style>
    <header className="dex-shell relative overflow-hidden text-white">
      {current.theme.motif && <ShellMotif motif={current.theme.motif} />}
      <div className="relative mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
        {/* The Pokédex's big lens and its three lights are the logo. */}
        <Link href="/" className="flex items-center gap-3">
          <span aria-hidden className="dex-lens block h-9 w-9 shrink-0 rounded-full" />
          <span aria-hidden className="hidden items-center gap-1.5 self-start pt-0.5 sm:flex">
            <span className="h-2.5 w-2.5 rounded-full border border-black/30 bg-[#ff7a6b]" />
            <span className="h-2.5 w-2.5 rounded-full border border-black/30 bg-[#ffcb05]" />
            <span className="h-2.5 w-2.5 rounded-full border border-black/30 bg-[#3ddc97]" />
          </span>
          <span className="font-display text-xl font-bold leading-none tracking-tight drop-shadow-[0_1px_0_rgb(0_0_0/0.25)]">
            {/* The shell is the same in light and dark, so its colours are fixed. */}
            Poké<span className="text-[#ffcb05]">Train</span>
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
                  className="relative block rounded-t-md rounded-b-sm px-3 pb-1.5 pt-2.5 font-display text-xs font-semibold text-white shadow-[0_2px_0_rgb(0_0_0/0.3)]"
                  style={{
                    background: `linear-gradient(160deg, ${g.theme.from}, ${g.theme.to})`,
                    opacity: active ? 1 : 0.6,
                    outline: active ? '2px solid #fff' : 'none',
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
              className="rounded-t-md rounded-b-sm border border-dashed border-white/40 px-3 pb-1.5 pt-2.5 text-xs text-white/70"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <div className="flex items-center rounded-md bg-black/20 p-0.5 text-xs shadow-inner" aria-label={t('Language')}>
            {(['es', 'en'] as const).map((l) => (
              <button
                key={l}
                disabled={pending}
                onClick={() => startTransition(() => setLang(l))}
                aria-pressed={lang === l}
                className={`rounded px-2 py-1 font-display uppercase ${lang === l ? 'bg-white font-semibold text-shell-dark' : 'text-white/80 hover:text-white'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

    </header>
    {/* The sections stay at the top while the page scrolls; the logo, the games and the language scroll away. */}
    <div className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur" style={{ height: 'var(--nav-h)' }}>
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
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center whitespace-nowrap px-3 font-display text-[15px] font-semibold ${i === firstRight ? 'ml-auto' : ''} ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label}
                {active && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute inset-x-2 bottom-0 h-[3px] rounded-t"
                    style={{ background: 'var(--game-accent)' }}
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
