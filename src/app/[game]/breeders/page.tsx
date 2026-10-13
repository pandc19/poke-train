import { notFound } from 'next/navigation';
import { BreedersBoard } from '@/components/BreedersBoard';
import { getLang, getT } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';
import { loadEditorOptions, loadRoster } from '@/lib/roster';

export default async function BreedersPage({ params, searchParams }: PageProps<'/[game]/breeders'>) {
  const { game: gameId } = await params;
  const { p: selected } = await searchParams;
  const { game, profileId } = await requireGameProfile(gameId);
  if (!game.features.breeding) notFound();

  const [breeders, options, lang, t] = await Promise.all([
    loadRoster(profileId, undefined, 'BREEDER'),
    loadEditorOptions(game),
    getLang(),
    getT(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">{t('{game} breeders', { game: game.shortName })}</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
        {t(
          'Record the Pokémon you keep to breed with: the Judge’s word for each IV, its nature and its ability. The breeding plans pick the best pair from these, and from the Pokémon in your Pokédex.'
        )}
      </p>
      <BreedersBoard
        gameId={game.id}
        initial={breeders}
        initialSelectedId={typeof selected === 'string' ? selected : null}
        options={options}
        lang={lang}
        judge={game.features.judge}
        accent={game.theme.accent}
      />
    </div>
  );
}
