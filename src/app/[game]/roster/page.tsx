import { RosterBoard } from '@/components/RosterBoard';
import { configuredProviderName, getAiProvider } from '@/lib/ai';
import { getLang, getT } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';
import { loadEditorOptions, loadRoster } from '@/lib/roster';
import { loadTeam, loadTrainingStat } from '@/lib/team';

export default async function RosterPage({ params, searchParams }: PageProps<'/[game]/roster'>) {
  const { game: gameId } = await params;
  const { p: selected } = await searchParams;
  const { game, profileId } = await requireGameProfile(gameId);
  const [roster, team, trainingStat, options, lang, t] = await Promise.all([
    loadRoster(profileId, undefined, 'ROSTER'),
    loadTeam(profileId),
    loadTrainingStat(profileId),
    loadEditorOptions(game),
    getLang(),
    getT(),
  ]);
  const provider = getAiProvider();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t('{game} trained roster', { game: game.shortName })}</h1>
      <RosterBoard
        gameId={game.id}
        initial={roster}
        initialTeam={team}
        initialTraining={trainingStat}
        initialSelectedId={typeof selected === 'string' ? selected : null}
        options={options}
        lang={lang}
        judge={game.features.judge}
        evs={game.features.evs}
        evTarget={game.features.evTarget}
        tera={game.features.teraType}
        accent={game.theme.accent}
        aiEnabled={provider != null}
        aiProvider={
          provider
            ? t('{provider}: {bulk} for single Pokémon, {deep} for the whole roster', {
                provider: provider.name,
                bulk: provider.modelFor('bulk'),
                deep: provider.modelFor('deep'),
              })
            : configuredProviderName()
        }
      />
    </div>
  );
}
