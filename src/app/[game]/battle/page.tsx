import { BattleBoard } from '@/components/BattleBoard';
import { loadOpponents } from '@/lib/battle/load';
import { prisma } from '@/lib/db';
import { getLang, getT } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';
import { TYPE_SLUGS } from '@/lib/pokemon-types';

export default async function BattlePage({ params }: PageProps<'/[game]/battle'>) {
  const { game: gameId } = await params;
  const { game, profileId } = await requireGameProfile(gameId);

  const [opponents, species, moves, lang, t] = await Promise.all([
    loadOpponents(game, profileId),
    // Any Pokémon can be an opponent, not only the ones obtainable in this game.
    prisma.species.findMany({ select: { id: true, nameEn: true, nameEs: true }, orderBy: { id: 'asc' } }),
    // Only moves that deal damage: they are what the counters have to withstand.
    prisma.move.findMany({
      where: { damageClass: { not: 'status' } },
      select: { id: true, nameEn: true, nameEs: true, type: true },
      orderBy: { nameEn: 'asc' },
    }),
    getLang(),
    getT(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">{t('Battle planner')}</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
        {t(
          'Add a Pokémon you have to beat, from a raid or any other battle, and see what it is weak to, the strongest moves against it, and which Pokémon of your roster (or of this game) to use. Everything comes from the game data: types, stats and the moves each Pokémon can learn.'
        )}
      </p>
      <BattleBoard
        gameId={game.id}
        initial={opponents}
        species={species}
        moves={moves}
        types={TYPE_SLUGS.filter((s) => s !== 'stellar' || game.features.teraType)}
        features={{ raids: game.features.raids, tera: game.features.teraType }}
        lang={lang}
      />
    </div>
  );
}
