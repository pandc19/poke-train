import { Sprite } from '@/components/Sprite';
import { StarterAdvice } from '@/components/StarterAdvice';
import { TypeBadge } from '@/components/TypeBadge';
import { getAiProvider } from '@/lib/ai';
import { prisma } from '@/lib/db';
import { getLang, pickName } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';

export default async function StarterTeamPage({ params }: PageProps<'/[game]/starter-team'>) {
  const { game: gameId } = await params;
  const { game, profileId } = await requireGameProfile(gameId);
  const slugs = game.starterRoles.flatMap((r) => r.picks.map((p) => p.slug));

  const [species, all, caught, roster, lang] = await Promise.all([
    prisma.species.findMany({
      where: { slug: { in: slugs } },
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameEs: true,
        forms: { where: { isDefault: true }, select: { spriteUrl: true, types: true }, take: 1 },
      },
    }),
    prisma.species.findMany({ select: { id: true, evolvesFromId: true } }),
    prisma.pokedexEntry.findMany({ where: { profileId }, select: { speciesId: true } }),
    prisma.rosterPokemon.findMany({ where: { profileId, owned: true }, select: { speciesId: true, baseSpeciesId: true } }),
    getLang(),
  ]);

  // A pick counts as owned when any stage of its evolution family is caught or in the roster.
  const parent = new Map(all.map((s) => [s.id, s.evolvesFromId]));
  const rootOf = (id: number) => {
    let cur = id;
    for (let next = parent.get(cur); next != null; next = parent.get(cur)) cur = next;
    return cur;
  };
  const ownedRoots = new Set(
    [...caught.map((c) => c.speciesId), ...roster.flatMap((r) => [r.speciesId, r.baseSpeciesId ?? r.speciesId])].map(rootOf)
  );
  const bySlug = new Map(species.map((s) => [s.slug, s]));

  return (
    <div>
      <h1 className="text-xl font-bold">{game.shortName} starter team</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
        A small utility core to pick up early: something to carry the story, something to catch with, and something
        to hatch eggs. Picks you already own are marked.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {game.starterRoles.map((role) => (
          <section key={role.id} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="font-semibold">{role.title}</h2>
            <p className="mt-1 text-sm text-muted">{role.why}</p>
            <ul className="mt-3 space-y-2">
              {role.picks.map((pick) => {
                const s = bySlug.get(pick.slug);
                if (!s) return null;
                const owned = ownedRoots.has(rootOf(s.id));
                return (
                  <li
                    key={pick.slug}
                    className={`flex gap-3 rounded-lg border p-2 ${owned ? 'border-done/50 bg-done/5' : 'border-line'}`}
                  >
                    <Sprite src={s.forms[0]?.spriteUrl ?? null} alt="" size={56} />
                    <div className="min-w-0 text-xs">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                        {pickName(s, lang)}
                        {s.forms[0]?.types.map((t) => <TypeBadge key={t} type={t} lang={lang} small />)}
                        {owned && <span className="rounded bg-done/15 px-1.5 text-[10px] font-medium text-done">you have this line</span>}
                      </p>
                      <p className="mt-0.5">{pick.note}</p>
                      {pick.where && <p className="mt-0.5 text-muted">Found: {pick.where}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {role.tips.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
                {role.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <StarterAdvice gameId={game.id} aiEnabled={getAiProvider() != null} />
    </div>
  );
}
