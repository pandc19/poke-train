import { RosterBoard } from '@/components/RosterBoard';
import { configuredProviderName, getAiProvider } from '@/lib/ai';
import { getLang } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';
import { loadEditorOptions, loadRoster } from '@/lib/roster';

export default async function RosterPage({ params }: PageProps<'/[game]/roster'>) {
  const { game: gameId } = await params;
  const { game, profileId } = await requireGameProfile(gameId);
  const [roster, options, lang] = await Promise.all([loadRoster(profileId), loadEditorOptions(game), getLang()]);
  const provider = getAiProvider();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{game.shortName} trained roster</h1>
      <RosterBoard
        gameId={game.id}
        initial={roster}
        options={options}
        lang={lang}
        aiEnabled={provider != null}
        aiProvider={provider ? `${provider.name} (${provider.model})` : configuredProviderName()}
      />
    </div>
  );
}
