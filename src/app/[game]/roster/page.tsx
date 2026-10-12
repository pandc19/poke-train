import { RosterBoard } from '@/components/RosterBoard';
import { configuredProviderName, getAiProvider } from '@/lib/ai';
import { getLang, getT } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';
import { loadEditorOptions, loadRoster } from '@/lib/roster';

export default async function RosterPage({ params }: PageProps<'/[game]/roster'>) {
  const { game: gameId } = await params;
  const { game, profileId } = await requireGameProfile(gameId);
  const [roster, options, lang, t] = await Promise.all([
    loadRoster(profileId),
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
        options={options}
        lang={lang}
        judge={game.features.judge}
        evs={game.features.evs}
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
