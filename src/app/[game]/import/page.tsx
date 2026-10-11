import { ImportWizard } from '@/components/ImportWizard';
import { getLang } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';

export default async function ImportPage({ params }: PageProps<'/[game]/import'>) {
  const { game: gameId } = await params;
  const { game } = await requireGameProfile(gameId);
  const lang = await getLang();
  return (
    <div>
      <h1 className="text-xl font-bold">Import a spreadsheet</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Bring your {game.shortName} training sheet in as roster Pokémon. You choose what each column means, review
        how it was read, then import.
      </p>
      <ImportWizard gameId={game.id} gameName={game.shortName} lang={lang} />
    </div>
  );
}
