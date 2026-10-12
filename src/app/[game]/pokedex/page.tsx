import { DexBrowser } from '@/components/DexBrowser';
import { getLang } from '@/lib/i18n';
import { loadDex } from '@/lib/pokedex';
import { requireGameProfile } from '@/lib/profile';

export default async function PokedexPage({ params, searchParams }: PageProps<'/[game]/pokedex'>) {
  const { game: gameId } = await params;
  const { dex } = await searchParams;
  const { game, profileId } = await requireGameProfile(gameId);
  const [lists, lang] = await Promise.all([
    // Every regional Pokédex is loaded, so switching tabs needs no round trip.
    Promise.all(game.pokedexes.map((d) => loadDex(d.slug, profileId, { gameId: game.id }))),
    getLang(),
  ]);
  const cellsBySlug = Object.fromEntries(game.pokedexes.map((d, i) => [d.slug, lists[i]]));

  return (
    <DexBrowser
      gameId={game.id}
      gameName={game.shortName}
      accent={game.theme.accent}
      tabColor={game.theme.from}
      dexes={game.pokedexes.map((d) => ({ slug: d.slug, name: d.name, note: d.note }))}
      cellsBySlug={cellsBySlug}
      initialSlug={typeof dex === 'string' ? dex : game.pokedexes[0].slug}
      lang={lang}
    />
  );
}
