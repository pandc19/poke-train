import Link from 'next/link';
import { DexGrid } from '@/components/DexGrid';
import { getLang } from '@/lib/i18n';
import { loadDex } from '@/lib/pokedex';
import { requireGameProfile } from '@/lib/profile';

export default async function PokedexPage({ params, searchParams }: PageProps<'/[game]/pokedex'>) {
  const { game: gameId } = await params;
  const { dex } = await searchParams;
  const { game, profileId } = await requireGameProfile(gameId);
  const current = game.pokedexes.find((d) => d.slug === dex) ?? game.pokedexes[0];
  const [cells, lang] = await Promise.all([loadDex(current.slug, profileId, { gameId: game.id }), getLang()]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{game.shortName} Pokédex</h1>
        <div className="flex gap-1">
          {game.pokedexes.map((d) => (
            <Link
              key={d.slug}
              href={`/${game.id}/pokedex?dex=${d.slug}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                d.slug === current.slug ? 'text-white' : 'bg-surface-2 text-muted hover:text-ink'
              }`}
              style={d.slug === current.slug ? { background: game.theme.from } : undefined}
            >
              {d.name}
            </Link>
          ))}
        </div>
      </div>
      <p className="-mt-3 mb-5 text-sm text-muted">
        <span className="font-medium text-ink">{current.name}</span>: {current.note}.{' '}
        {current.slug !== 'paldea' && 'You only need this dex if you own the expansion.'}
      </p>
      {/* keyed so switching dex resets search, filter and optimistic state */}
      <DexGrid key={current.slug} cells={cells} lang={lang} gameId={game.id} accent={game.theme.accent} />
    </div>
  );
}
