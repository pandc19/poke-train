import { DexBrowser } from '@/components/DexBrowser';
import { EXTRA_DEX_SLUG, NATIONAL_DEX_SLUG } from '@/lib/games';
import { getLang } from '@/lib/i18n';
import { loadDex } from '@/lib/pokedex';
import { requireGameProfile } from '@/lib/profile';

export default async function PokedexPage({ params, searchParams }: PageProps<'/[game]/pokedex'>) {
  const { game: gameId } = await params;
  const { dex } = await searchParams;
  const { game, profileId } = await requireGameProfile(gameId);
  const slugs = [...game.pokedexes.map((d) => d.slug), ...(game.nationalDex ? [NATIONAL_DEX_SLUG] : []), ...(game.extraForms ? [EXTRA_DEX_SLUG] : [])];
  const [lists, lang] = await Promise.all([
    // Every Pokédex is loaded, so switching tabs needs no round trip.
    Promise.all(slugs.map((slug) => loadDex(slug, profileId, { gameId: game.id }))),
    getLang(),
  ]);
  const cellsBySlug = Object.fromEntries(slugs.map((slug, i) => [slug, lists[i]]));

  return (
    <DexBrowser
      gameId={game.id}
      gameName={game.shortName}
      accent={'var(--game-accent)'}
      tabColor={game.theme.from}
      dexes={[
        ...game.pokedexes.map((d) => ({ slug: d.slug, name: d.name, note: d.note })),
        ...(game.nationalDex
          ? [{ slug: NATIONAL_DEX_SLUG, name: { en: 'National', es: 'Nacional' }, note: { en: '', es: '' }, national: true }]
          : []),
        ...(game.extraForms ? [{ slug: EXTRA_DEX_SLUG, name: game.extraForms.name, note: game.extraForms.note, sectioned: true }] : []),
      ]}
      cellsBySlug={cellsBySlug}
      initialSlug={typeof dex === 'string' && slugs.includes(dex) ? dex : game.pokedexes[0].slug}
      lang={lang}
    />
  );
}
