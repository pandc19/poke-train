import { DexGrid } from '@/components/DexGrid';
import { NATIONAL_DEX_SLUG } from '@/lib/games';
import { getLang } from '@/lib/i18n';
import { loadDex } from '@/lib/pokedex';

export default async function NationalDexPage() {
  const [cells, lang] = await Promise.all([loadDex(NATIONAL_DEX_SLUG, null), getLang()]);
  return (
    <div>
      <h1 className="text-xl font-bold">National Pokédex</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Filled in automatically from every game. Mark a Pokémon as caught in a game&apos;s Pokédex and it appears
        here, tagged with the game it came from.
      </p>
      <DexGrid cells={cells} lang={lang} gameId={null} />
    </div>
  );
}
