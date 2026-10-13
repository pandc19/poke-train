import { notFound } from 'next/navigation';
import { BreedingBoard } from '@/components/BreedingBoard';
import { getAiProvider } from '@/lib/ai';
import { loadGoals } from '@/lib/breeding/goals';
import { prisma } from '@/lib/db';
import { getLang, getT } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';
import { loadRoster } from '@/lib/roster';

export default async function BreedingPage({ params }: PageProps<'/[game]/breeding'>) {
  const { game: gameId } = await params;
  const { game, profileId } = await requireGameProfile(gameId);
  if (!game.features.breeding) notFound();

  const named = { id: true, nameEn: true, nameEs: true } as const;
  const [goals, roster, species, natures, lang, t] = await Promise.all([
    loadGoals(game, profileId),
    loadRoster(profileId, undefined, 'ROSTER'),
    // Only Pokémon obtainable in this game can be bred in it.
    prisma.species.findMany({
      where: { pokedexSlots: { some: { pokedex: { gameId: game.id } } } },
      select: named,
      orderBy: { id: 'asc' },
    }),
    prisma.nature.findMany({ select: named, orderBy: { nameEn: 'asc' } }),
    getLang(),
    getT(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">{t('Breeding assistant')}</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
        {t(
          'Say which Pokémon you want. The plan checks the Pokémon and genders you recorded in your Pokédex, roster and breeders, then lists what you already have and what you still need to catch or breed.'
        )}
        {game.features.mirrorHerb &&
          ` ${t('In this game a Mirror Herb picnic can copy egg moves without hatching anything.')}`}
      </p>
      <BreedingBoard
        gameId={game.id}
        initial={goals}
        species={species}
        natures={natures}
        lang={lang}
        aiEnabled={getAiProvider() != null}
        rosterBuilds={roster
          .filter((p) => p.moves.some((m) => m.move))
          .map((p) => ({
            speciesId: p.species.id,
            species: p.species,
            moves: p.moves.flatMap((m) => (m.move ? [m.move] : [])),
          }))}
      />
    </div>
  );
}
