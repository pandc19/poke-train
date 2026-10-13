'use client';

import { useMemo, useState } from 'react';
import { DexGrid } from './DexGrid';
import type { Lang, Localized } from '@/lib/i18n';
import type { DexCell } from '@/lib/pokedex';
import { pick } from '@/lib/translate';
import { useT } from '@/lib/translate-client';

/**
 * A game's regional Pokédexes, and its National Dex, behind tabs. Switching tabs happens in place, so
 * the search text and the filter stay as they are, and a Pokémon that is in
 * two Pokédexes is the same one in both (the caught state is shared).
 */
export function DexBrowser({
  gameId,
  gameName,
  accent,
  tabColor,
  dexes,
  cellsBySlug,
  initialSlug,
  lang,
}: {
  gameId: string;
  gameName: string;
  accent: string;
  tabColor: string;
  /** The National Dex has `national` set: it lists every species and has its own note. */
  dexes: { slug: string; name: Localized; note: Localized; national?: boolean }[];
  cellsBySlug: Record<string, DexCell[]>;
  initialSlug: string;
  lang: Lang;
}) {
  const { t } = useT();
  const [slug, setSlug] = useState(dexes.some((d) => d.slug === initialSlug) ? initialSlug : dexes[0].slug);
  const current = dexes.find((d) => d.slug === slug) ?? dexes[0];

  // One entry per card across all the tabs, so caught state starts right everywhere.
  const everySpecies = useMemo(() => {
    const bySpecies = new Map<number, DexCell>();
    for (const cells of Object.values(cellsBySlug)) for (const c of cells) bySpecies.set(c.key, c);
    return [...bySpecies.values()];
  }, [cellsBySlug]);

  const select = (next: string) => {
    setSlug(next);
    // Keep the address in step, so a reload comes back to the same tab.
    window.history.replaceState(null, '', `?dex=${next}`);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{t('{game} Pokédex', { game: gameName })}</h1>
        <div className="flex gap-1" role="tablist">
          {dexes.map((d) => (
            <button
              key={d.slug}
              role="tab"
              aria-selected={d.slug === slug}
              onClick={() => select(d.slug)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                d.slug === slug ? 'text-white' : 'bg-surface-2 text-muted hover:text-ink'
              }`}
              style={d.slug === slug ? { background: tabColor } : undefined}
            >
              {pick(d.name, lang)}
            </button>
          ))}
        </div>
      </div>
      {current.national ? (
        <p className="-mt-3 mb-5 max-w-3xl text-sm text-muted">
          {t(
            'Every Pokémon, numbered by National Dex number. This is your {game} save only: the same caught list as the regional Pokédexes, so marking one here marks it there. Pokémon caught in your other games show a badge but do not count as caught here.',
            { game: gameName }
          )}
        </p>
      ) : (
        <p className="-mt-3 mb-5 text-sm text-muted">
          <span className="font-medium text-ink">{pick(current.name, lang)}</span>: {pick(current.note, lang)}.{' '}
          {current.slug !== 'paldea' && t('You only need this dex if you own the expansion.')}
        </p>
      )}
      <DexGrid
        cells={cellsBySlug[current.slug] ?? []}
        stateCells={everySpecies}
        lang={lang}
        gameId={gameId}
        gameName={gameName}
        accent={accent}
      />
    </div>
  );
}
