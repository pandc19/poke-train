import { DexGrid } from '@/components/DexGrid';
import { NATIONAL_DEX_SLUG } from '@/lib/games';
import { getLang } from '@/lib/i18n';
import { loadDex } from '@/lib/pokedex';
import { requireGameProfile } from '@/lib/profile';

export default async function NationalDexPage({ params }: PageProps<'/[game]/national'>) {
  const { game: gameId } = await params;
  const { game, profileId } = await requireGameProfile(gameId);
  const [cells, lang] = await Promise.all([
    loadDex(NATIONAL_DEX_SLUG, profileId, { gameId: game.id }),
    getLang(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">{game.shortName} National Pokédex</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
        Every Pokémon, numbered by National Dex number. This is your {game.shortName} save only: the same caught
        list as the regional Pokédexes, so marking one here marks it there. Pokémon caught in your other games show a
        badge but do not count as caught here.
      </p>
      {/* keyed so a different game never reuses this one's optimistic state */}
      <DexGrid key={game.id} cells={cells} lang={lang} gameId={game.id} gameName={game.shortName} accent={game.theme.accent} />
    </div>
  );
}
