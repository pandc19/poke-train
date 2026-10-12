import { Sprite } from '@/components/Sprite';
import { StarterAdvice } from '@/components/StarterAdvice';
import { TypeBadge } from '@/components/TypeBadge';
import { getAiProvider } from '@/lib/ai';
import { prisma } from '@/lib/db';
import type { UtilityRole } from '@/lib/games';
import { getLang, getT, pick, pickName } from '@/lib/i18n';
import { requireGameProfile } from '@/lib/profile';

const SHOWN = 18;

export default async function StarterTeamPage({ params }: PageProps<'/[game]/starter-team'>) {
  const { game: gameId } = await params;
  const { game, profileId } = await requireGameProfile(gameId);
  const [lang, t] = await Promise.all([getLang(), getT()]);

  const moveSlugs = [...new Set(game.utilityRoles.flatMap((r) => [...(r.needs.allMoves ?? []), ...(r.needs.anyMoves ?? [])]))];
  const abilitySlugs = [...new Set(game.utilityRoles.flatMap((r) => r.needs.anyAbilities ?? []))];

  const [species, slots, learnRows, abilityRows, caught, roster] = await Promise.all([
    prisma.species.findMany({
      select: {
        id: true,
        nameEn: true,
        nameEs: true,
        evolvesFromId: true,
        forms: { where: { isDefault: true }, select: { spriteUrl: true, types: true }, take: 1 },
      },
    }),
    prisma.pokedexSlot.findMany({
      where: { pokedex: { gameId: game.id } },
      select: { speciesId: true, entryNumber: true, pokedex: { select: { sortOrder: true } } },
    }),
    moveSlugs.length
      ? prisma.learnset.findMany({
          where: { versionGroup: { in: game.learnsetVersionGroups }, move: { slug: { in: moveSlugs } } },
          select: { move: { select: { slug: true } }, form: { select: { speciesId: true } } },
          distinct: ['formId', 'moveId'],
        })
      : [],
    abilitySlugs.length
      ? prisma.formAbility.findMany({
          where: { ability: { slug: { in: abilitySlugs } } },
          select: { ability: { select: { slug: true } }, form: { select: { speciesId: true } } },
        })
      : [],
    prisma.pokedexEntry.findMany({ where: { profileId }, select: { speciesId: true } }),
    prisma.rosterPokemon.findMany({ where: { profileId, owned: true }, select: { speciesId: true } }),
  ]);

  const byId = new Map(species.map((s) => [s.id, s]));
  const rootOf = (id: number) => {
    let cur = id;
    for (let next = byId.get(cur)?.evolvesFromId; next != null; next = byId.get(cur)?.evolvesFromId) cur = next;
    return cur;
  };

  const learnedBy = new Map<number, Set<string>>();
  for (const r of learnRows) {
    if (!learnedBy.has(r.form.speciesId)) learnedBy.set(r.form.speciesId, new Set());
    learnedBy.get(r.form.speciesId)!.add(r.move.slug);
  }
  const abilitiesOf = new Map<number, Set<string>>();
  for (const r of abilityRows) {
    if (!abilitiesOf.has(r.form.speciesId)) abilitiesOf.set(r.form.speciesId, new Set());
    abilitiesOf.get(r.form.speciesId)!.add(r.ability.slug);
  }
  /** Moves a species learns itself or inherits from earlier stages of its line. */
  const movesOf = (id: number) => {
    const out = new Set<string>();
    for (let cur: number | null | undefined = id, guard = 0; cur != null && guard < 5; guard++) {
      for (const m of learnedBy.get(cur) ?? []) out.add(m);
      cur = byId.get(cur)?.evolvesFromId;
    }
    return out;
  };

  // Base-game Pokémon sort first: they are the ones available early.
  const order = new Map<number, number>();
  for (const s of slots) {
    const key = s.pokedex.sortOrder * 10000 + s.entryNumber;
    order.set(s.speciesId, Math.min(order.get(s.speciesId) ?? Infinity, key));
  }
  const ownedRoots = new Set([...caught, ...roster].map((r) => rootOf(r.speciesId)));

  const canDo = (id: number, role: UtilityRole) => {
    const { allMoves = [], anyMoves = [], anyAbilities = [] } = role.needs;
    if (anyAbilities.length && [...(abilitiesOf.get(id) ?? [])].some((a) => anyAbilities.includes(a))) return true;
    if (!allMoves.length && !anyMoves.length) return false;
    const moves = movesOf(id);
    return allMoves.every((m) => moves.has(m)) && (!anyMoves.length || anyMoves.some((m) => moves.has(m)));
  };

  const roles = game.utilityRoles.map((role) => {
    const eligible = [...order.keys()]
      .filter((id) => canDo(id, role))
      .sort((a, b) => order.get(a)! - order.get(b)!)
      .map((id) => ({ ...byId.get(id)!, owned: ownedRoots.has(rootOf(id)) }));
    return { role, eligible, have: eligible.filter((s) => s.owned) };
  });

  const PokemonTile = ({ s }: { s: (typeof roles)[number]['eligible'][number] }) => (
    <li
      className={`flex items-center gap-2 rounded-lg border p-1.5 pr-3 ${s.owned ? 'border-done/50 bg-done/5' : 'border-line'}`}
    >
      <Sprite src={s.forms[0]?.spriteUrl ?? null} alt="" size={44} />
      <span className="min-w-0 text-xs">
        <span className="block truncate font-semibold">{pickName(s, lang)}</span>
        <span className="flex gap-1">
          {s.forms[0]?.types.map((type) => <TypeBadge key={type} type={type} lang={lang} small />)}
        </span>
      </span>
    </li>
  );

  return (
    <div>
      <h1 className="text-xl font-bold">{t('{game} starter team', { game: game.shortName })}</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
        {t(
          'Some jobs are worth having covered early. For each one below, this page checks the real {game} movesets and abilities, and tells you whether you already have a Pokémon that can do it, using your Pokédex and roster.',
          { game: game.shortName }
        )}
      </p>

      <div className="space-y-5">
        {roles.map(({ role, eligible, have }) => (
          <section key={role.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold">{pick(role.title, lang)}</h2>
              {have.length > 0 ? (
                <span className="rounded bg-done/15 px-2 py-0.5 text-xs font-medium text-done">
                  {have.length === 1 ? t('You already have one') : t('You already have {count}', { count: have.length })}
                </span>
              ) : (
                <span className="rounded bg-pending/15 px-2 py-0.5 text-xs font-medium text-pending">
                  {t('You do not have one yet')}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">{pick(role.why, lang)}</p>

            {have.length > 0 && (
              <div className="mt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-done">{t('Yours')}</h3>
                <ul className="flex flex-wrap gap-2">
                  {have.map((s) => (
                    <PokemonTile key={s.id} s={s} />
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {have.length > 0 ? t('Other options') : t('Pokémon that can do this')} ({eligible.length - have.length})
              </h3>
              <ul className="flex flex-wrap gap-2">
                {eligible
                  .filter((s) => !s.owned)
                  .slice(0, SHOWN)
                  .map((s) => (
                    <PokemonTile key={s.id} s={s} />
                  ))}
              </ul>
              {eligible.length - have.length > SHOWN && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                    {t('Show the other {count}', { count: eligible.length - have.length - SHOWN })}
                  </summary>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {eligible
                      .filter((s) => !s.owned)
                      .slice(SHOWN)
                      .map((s) => (
                        <PokemonTile key={s.id} s={s} />
                      ))}
                  </ul>
                </details>
              )}
              <p className="mt-2 text-[11px] text-muted">
                {t(
                  'Listed with base-game Pokémon first. A Pokémon counts as yours if you have caught it or any stage of its evolution line.'
                )}
              </p>
            </div>

            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
              {role.tips.map((tip, i) => (
                <li key={i}>{pick(tip, lang)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <StarterAdvice gameId={game.id} aiEnabled={getAiProvider() != null} />
    </div>
  );
}
