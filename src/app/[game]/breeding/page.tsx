import { notFound } from 'next/navigation';
import { BreedingBoard } from '@/components/BreedingBoard';
import { getAiProvider } from '@/lib/ai';
import { loadGoals } from '@/lib/breeding/goals';
import { prisma } from '@/lib/db';
import { getLang } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';
import { loadRoster } from '@/lib/roster';

export default async function BreedingPage({ params }: PageProps<'/[game]/breeding'>) {
  const { game: gameId } = await params;
  const { game, profileId } = await requireGameProfile(gameId);
  if (!game.features.breeding) notFound();

  const named = { id: true, nameEn: true, nameEs: true } as const;
  const [goals, roster, species, moves, lang] = await Promise.all([
    loadGoals(profileId),
    loadRoster(profileId),
    // Only Pokémon obtainable in this game can be bred in it.
    prisma.species.findMany({
      where: { pokedexSlots: { some: { pokedex: { gameId: game.id } } } },
      select: named,
      orderBy: { id: 'asc' },
    }),
    prisma.move.findMany({ select: named, orderBy: { nameEn: 'asc' } }),
    getLang(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">Breeding assistant</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
        Pick a Pokémon and the moves you want it to hatch with. The plan checks your roster and Pokédex for
        parents first, then tells you what to catch.
        {game.features.mirrorHerb && ' In this game a Mirror Herb picnic can copy egg moves without hatching anything.'}
      </p>
      <BreedingBoard
        gameId={game.id}
        initial={goals}
        species={species}
        moves={moves}
        lang={lang}
        aiEnabled={getAiProvider() != null}
        rosterSuggestions={roster
          .filter((p) => p.moves.some((m) => m.status === 'PENDING' && m.move))
          .map((p) => ({
            id: p.id,
            species: p.species,
            pendingMoves: p.moves.filter((m) => m.status === 'PENDING' && m.move).map((m) => m.move!),
          }))}
      />
    </div>
  );
}
