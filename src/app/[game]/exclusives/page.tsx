import { notFound } from 'next/navigation';
import { ExclusivesBoard, type ExclusiveGroupView, type ExclusiveTile } from '@/components/ExclusivesBoard';
import { prisma } from '@/lib/db';
import { getLang } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';

export default async function ExclusivesPage({ params }: PageProps<'/[game]/exclusives'>) {
  const { game: gameId } = await params;
  const { game, profileId } = await requireGameProfile(gameId);
  const ve = game.versionExclusives;
  if (!ve) notFound();

  const dexNumbers = [...new Set(ve.groups.flatMap((g) => [...g.own, ...g.other].map((e) => e.dex)))];
  const [species, entries, roster, lang] = await Promise.all([
    prisma.species.findMany({
      where: { id: { in: dexNumbers } },
      select: {
        id: true,
        nameEn: true,
        nameEs: true,
        forms: { where: { isDefault: true }, select: { spriteUrl: true }, take: 1 },
      },
    }),
    prisma.pokedexEntry.findMany({ where: { profileId, speciesId: { in: dexNumbers } }, select: { speciesId: true, owned: true } }),
    prisma.rosterPokemon.findMany({ where: { profileId, owned: true, speciesId: { in: dexNumbers } }, select: { speciesId: true } }),
    getLang(),
  ]);
  const byId = new Map(species.map((s) => [s.id, s]));
  const caught = new Map(entries.map((e) => [e.speciesId, e.owned]));
  const inRoster = new Set(roster.map((r) => r.speciesId));

  const tile = (e: { dex: number; form?: string }): ExclusiveTile => {
    const s = byId.get(e.dex);
    const isCaught = caught.has(e.dex) || inRoster.has(e.dex);
    return {
      dex: e.dex,
      form: e.form ?? null,
      nameEn: s?.nameEn ?? `#${e.dex}`,
      nameEs: s?.nameEs ?? `#${e.dex}`,
      spriteUrl: s?.forms[0]?.spriteUrl ?? null,
      caught: isCaught,
      have: inRoster.has(e.dex) || caught.get(e.dex) === true,
    };
  };

  const groups: ExclusiveGroupView[] = ve.groups.map((g) => ({
    id: g.id,
    label: g.label,
    note: g.note,
    own: g.own.map(tile),
    other: g.other.map(tile),
  }));

  return (
    <div>
      <h1 className="text-xl font-bold">
        {ve.ownName} and {ve.otherName} exclusives
      </h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
        Some Pokémon can only be caught in one of the two versions. You are playing {ve.ownName}, so these are the
        ones you will never find in the wild here, and the ones that are yours alone. Click one for its details.
      </p>
      <ExclusivesBoard
        gameId={game.id}
        ownName={ve.ownName}
        otherName={ve.otherName}
        howToGetOther={ve.howToGetOther}
        groups={groups}
        lang={lang}
      />
      <p className="mt-6 text-[11px] text-muted">
        Source: {ve.source.name}, retrieved {ve.source.retrieved}. This list is kept by hand because PokéAPI has no
        encounter data for these games, so check it if an update changes availability. Pokémon with a form label
        (Tauros, Alolan Sandshrew and the like) exist in both versions; only that form is exclusive.
      </p>
    </div>
  );
}
