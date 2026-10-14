'use client';

import { useEffect, useRef, useState } from 'react';
import { AiBadge } from './AiBadge';
import { ConfirmDialog } from './Dialog';
import { HatchDialog } from './HatchDialog';
import { ComboInput } from './roster/parts';
import { Sprite } from './Sprite';
import { useCachedLocations } from './useCachedLocations';
import { STAT_LABELS } from './EvInputs';
import type { LocationResult } from '@/lib/ai/schema';
import { IV_STATS, type IvStat, type MoveOption, type MovePlan, type ShoppingItem, type SpeciesRef, type Step } from '@/lib/breeding/engine';
import type { BreedingGoalView } from '@/lib/breeding/goals';
import { ABILITY_PATCH, DESTINY_KNOT, EVERSTONE, MIRROR_HERB, POWER_ITEMS } from '@/lib/breeding/items';
import type { IvPlan, ParentPick } from '@/lib/breeding/ivs';
import type { Lang } from '@/lib/i18n';
import { useT } from '@/lib/translate-client';

type Named = { id: number; nameEn: string; nameEs: string };
type RosterBuild = { speciesId: number; species: Named; moves: Named[] };
type LocationState = { busy: boolean; result?: LocationResult; error?: string };

const inputClass = 'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm placeholder:text-muted';
/** One green per stage, from a quiet one for planned to a bright one for done. */
const STAGE_COLOR: Record<BreedingGoalView['status'], string> = {
  PLANNED: '#5b8f7b',
  IN_PROGRESS: '#34d399',
  DONE: '#4ade80',
};

/** The egg that says where a plan is: still, rocking about to hatch, or hatched. */
function StageBadge({ status, label, size = 'md' }: { status: BreedingGoalView['status']; label?: string; size?: 'sm' | 'md' }) {
  const color = STAGE_COLOR[status];
  const icon =
    status === 'DONE' ? (
      <span className="egg-hatch">🐣</span>
    ) : status === 'IN_PROGRESS' ? (
      <span className="egg-wobble">🥚</span>
    ) : (
      <span className="opacity-50 grayscale">🥚</span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        size === 'sm' ? 'px-1.5 py-0 text-[10px]' : 'px-2.5 py-0.5 text-xs'
      }`}
      style={{
        color,
        borderColor: `${color}80`,
        backgroundColor: `${color}1a`,
        boxShadow: status === 'DONE' ? `0 0 10px ${color}55` : undefined,
      }}
    >
      <span aria-hidden="true" className={size === 'sm' ? 'text-xs' : 'text-base leading-none'}>
        {icon}
      </span>
      {label}
    </span>
  );
}

const symbol = (g?: 'male' | 'female') => (g === 'male' ? '♂ ' : g === 'female' ? '♀ ' : '');

export function BreedingBoard({
  gameId,
  initial,
  species,
  sprites,
  natures,
  lang,
  aiEnabled,
  rosterBuilds,
  picnic,
}: {
  gameId: string;
  initial: BreedingGoalView[];
  species: Named[];
  /** Picture of each Pokémon (by species id). */
  sprites: Record<number, string>;
  natures: Named[];
  lang: Lang;
  aiEnabled: boolean;
  rosterBuilds: RosterBuild[];
  /** The game has picnics (Egg Power sandwiches). */
  picnic: boolean;
}) {
  const { t } = useT();
  const optionTitles: Record<MoveOption['kind'], string> = {
    'mirror-herb': t('Mirror Herb picnic (no egg needed)'),
    breed: t('Breed with a father that knows it'),
    chain: t('Chain breeding (several generations)'),
  };
  const statusLabels: Record<BreedingGoalView['status'], string> = {
    PLANNED: t('Planned'),
    IN_PROGRESS: t('In progress'),
    DONE: t('Done'),
  };
  const [goals, setGoals] = useState(initial);
  /** The plan whose details are shown; the newest one to begin with. */
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const selected = goals.find((g) => g.id === selectedId) ?? goals[0] ?? null;
  const detailRef = useRef<HTMLDivElement>(null);
  const select = (id: string) => {
    setSelectedId(id);
    // On a narrow screen the details sit below the list.
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };
  const [hatchOpen, setHatchOpen] = useState(false);
  const [target, setTarget] = useState('');
  /** One move id (or none) per slot, chosen from the moves the Pokémon can have. */
  const [wanted, setWanted] = useState<(number | null)[]>([null, null, null, null]);
  const [options, setOptions] = useState<{ egg: Named[]; other: Named[] } | null>(null);
  /** What the offspring should be like, besides its moves. */
  const [ivTargets, setIvTargets] = useState<IvStat[]>([]);
  const [natureText, setNatureText] = useState('');
  const [hiddenAbility, setHiddenAbility] = useState(false);
  const [filledFromRoster, setFilledFromRoster] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Record<number, LocationState>>({});
  // Lookups opened this visit; answers saved earlier start collapsed.
  const [openLocations, setOpenLocations] = useState<Set<number>>(new Set());
  const savedLocations = useCachedLocations(
    gameId,
    goals.flatMap((g) => g.plan?.shopping.filter((s) => s.have === 'missing').map((s) => s.species.id) ?? [])
  );
  const [deleting, setDeleting] = useState<BreedingGoalView | null>(null);

  const name = (x: Named | SpeciesRef) => (lang === 'en' ? x.nameEn : x.nameEs);
  const pic = (x: { id: number }, size = 44) => <Sprite src={sprites[x.id] ?? null} alt="" size={size} />;
  const find = (list: Named[], text: string) => {
    const t = text.trim().toLowerCase();
    return list.find((x) => x.nameEn.toLowerCase() === t || x.nameEs.toLowerCase() === t);
  };

  async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? t('Request failed ({status})', { status: res.status }));
    return data as T;
  }

  const targetId = find(species, target)?.id ?? null;

  /** Choosing a different Pokémon starts the move slots over. */
  function onTargetChange(text: string) {
    setTarget(text);
    if ((find(species, text)?.id ?? null) !== targetId) {
      setWanted([null, null, null, null]);
      setOptions(null);
      setFilledFromRoster(false);
      setSkipped(0);
    }
  }

  // Load what this Pokémon can have, then fill in the build from your roster when you have one.
  useEffect(() => {
    if (targetId == null) return;
    const controller = new AbortController();
    fetch(`/api/breeding/moves?gameId=${encodeURIComponent(gameId)}&speciesId=${targetId}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { egg: Named[]; other: Named[] }) => {
        setOptions(data);
        const build = rosterBuilds.find((b) => b.speciesId === targetId);
        if (!build) return;
        // Only egg moves need breeding; the rest the Pokémon learns normally, so they are not slots to fill.
        const eggIds = new Set(data.egg.map((m) => m.id));
        const usable = build.moves.map((m) => m.id).filter((id) => eggIds.has(id)).slice(0, 4);
        setWanted([0, 1, 2, 3].map((i) => usable[i] ?? null));
        setSkipped(build.moves.length - usable.length);
        // Only "filled in" when something went into a slot.
        setFilledFromRoster(usable.length > 0);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(t('Could not load the moves for that Pokémon. Try again.'));
      });
    return () => controller.abort();
  }, [targetId, gameId, rosterBuilds, t]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const s = find(species, target);
    if (!s) {
      setError(t('"{name}" is not a Pokémon available in this game. Pick one from the suggestions.', { name: target }));
      return;
    }
    const moveIds = wanted.filter((m): m is number => m != null);
    const nature = natureText.trim() ? find(natures, natureText) : undefined;
    if (natureText.trim() && !nature) {
      setError(t('"{name}" is not a nature. Pick one from the suggestions.', { name: natureText }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ goal: BreedingGoalView }>('/api/breeding', 'POST', {
        gameId,
        speciesId: s.id,
        moveIds,
        ivTargets,
        natureId: nature?.id ?? null,
        hiddenAbility,
      });
      setGoals((prev) => [data.goal, ...prev]);
      setSelectedId(data.goal.id);
      setTarget('');
      setIvTargets([]);
      setNatureText('');
      setHiddenAbility(false);
      setWanted([null, null, null, null]);
      setOptions(null);
      setFilledFromRoster(false);
      setSkipped(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not create the plan.'));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: BreedingGoalView['status']) {
    setError(null);
    try {
      const data = await api<{ goal: BreedingGoalView }>(`/api/breeding/${id}`, 'PATCH', { status });
      setGoals((prev) => prev.map((g) => (g.id === id ? data.goal : g)));
    } catch {
      setError(t('Could not update that plan. Try again.'));
    }
  }

  async function remove(goal: BreedingGoalView) {
    setDeleting(null);
    try {
      await api(`/api/breeding/${goal.id}`, 'DELETE');
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    } catch {
      setError(t('Could not delete that plan. Try again.'));
    }
  }

  async function locate(s: SpeciesRef, refresh = false) {
    setLocations((prev) => ({ ...prev, [s.id]: { busy: true } }));
    try {
      const data = await api<{ result: LocationResult }>('/api/ai/location', 'POST', { gameId, speciesId: s.id, refresh });
      setLocations((prev) => ({ ...prev, [s.id]: { busy: false, result: data.result } }));
      setOpenLocations((prev) => new Set(prev).add(s.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Lookup failed.');
      setLocations((prev) => ({ ...prev, [s.id]: { busy: false, error: message } }));
    }
  }

  const moveName = (goal: BreedingGoalView, id?: number) => {
    const m = goal.moves.find((x) => x.id === id);
    return m ? name(m) : t('the move');
  };

  const describe = (goal: BreedingGoalView, item: ShoppingItem): string => {
    const forMove = moveName(goal, item.forMoveId);
    if (item.have === 'ready') {
      if (item.role === 'mother') return t('You have a female. She will be the mother.');
      if (item.role === 'father') return t('You have a male that knows {move}.', { move: forMove });
      return t('You have it.');
    }
    if (item.have === 'caught') {
      if (item.role === 'father') {
        return t(
          'You have it, but either its gender is not recorded or it does not know {move}. Record the gender in your Pokédex, or teach it {move}.',
          { move: forMove }
        );
      }
      if (item.role === 'mother') {
        return t('You have caught this line, but not a recorded female. Record her gender in your Pokédex or roster.');
      }
      return t('You have caught it, but it does not know the move yet.');
    }
    if (item.wrongGender) {
      return item.gender === 'male'
        ? t('You only have the other gender registered. You need a male one.')
        : item.gender === 'female'
          ? t('You only have the other gender registered. You need a female one.')
          : t('You only have the other gender registered. You need a matching one.');
    }
    return t('You do not have this yet.');
  };

  const roleLabel = (goal: BreedingGoalView, item: ShoppingItem) => {
    if (item.role === 'mother') return t('mother (the egg hatches as her species)');
    if (item.role === 'ditto') return t('Ditto (the other parent)');
    if (item.role === 'father') return t('father, passes down {move}', { move: moveName(goal, item.forMoveId) });
    return t('knows {move}, shares it at a picnic', { move: moveName(goal, item.forMoveId) });
  };

  const renderItem = (goal: BreedingGoalView, item: ShoppingItem, key: number) => {
    const result = locations[item.species.id]?.result ?? savedLocations[item.species.id];
    const location = locations[item.species.id];
    const isOpen = openLocations.has(item.species.id);
    const canLookUp = item.have === 'missing';
    return (
      <li key={key} className="rounded-lg border border-line p-2 text-xs">
        <div className="flex items-center gap-2">
          {pic(item.species, 48)}
          <p className="text-sm font-semibold">
            {symbol(item.gender)}
            {name(item.species)} <span className="text-xs font-normal text-muted">· {roleLabel(goal, item)}</span>
          </p>
        </div>
        <p className="mt-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              item.have === 'ready'
                ? 'bg-done/15 text-done'
                : item.have === 'caught'
                  ? 'bg-star/15 text-star'
                  : 'bg-pending/15 text-pending'
            }`}
          >
            {item.have === 'ready' ? t('Ready') : item.have === 'caught' ? t('Check it') : t('You need it')}
          </span>
        </p>
        {item.have !== 'ready' && (
          <p className={`mt-1 ${item.have === 'caught' ? 'text-star' : 'text-pending'}`}>{describe(goal, item)}</p>
        )}
        {canLookUp && (
          <button
            onClick={() =>
              result
                ? setOpenLocations((prev) => {
                    const next = new Set(prev);
                    if (!next.delete(item.species.id)) next.add(item.species.id);
                    return next;
                  })
                : locate(item.species)
            }
            disabled={!aiEnabled || location?.busy}
            title={aiEnabled ? t('Researched on the web with AI') : t('Add an API key to .env.local to enable location lookups')}
            className="mt-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink disabled:opacity-40"
          >
            {location?.busy
              ? t('Searching…')
              : result
                ? isOpen
                  ? t('Hide')
                  : t('Show')
                : t('Where do I catch it?')}
          </button>
        )}
        {location?.error && <p className="mt-1 text-pending">{location.error}</p>}
        {result && isOpen && (
          <div className="mt-1 rounded bg-surface-2 p-2 text-muted">
            {result.locations.map((l, i) => (
              <p key={i}>
                <span className="font-medium text-ink">{l.place}</span>
                {l.nearby && ` · ${t('Near')}: ${l.nearby}`} · {l.details}
              </p>
            ))}
            {result.notes && <p className="mt-1">{result.notes}</p>}
            <button
              onClick={() => locate(item.species, true)}
              disabled={!aiEnabled || location?.busy}
              className="mt-1 text-[10px] underline disabled:opacity-40"
            >
              {location?.busy ? t('Searching…') : t('Search again')}
            </button>
            <p className="mt-1 flex items-center gap-1.5 text-[10px]">
              <AiBadge /> {t('AI-researched. Check in game before relying on it.')}
            </p>
          </div>
        )}
      </li>
    );
  };

  const renderStep = (step: Step, key: number) => {
    /** The picture(s) of the Pokémon a step is about, then its text. */
    const row = (pics: SpeciesRef[], text: React.ReactNode) => (
      <li key={key} className="flex items-center gap-2">
        <span className="flex shrink-0">{pics.map((x) => <span key={`${x.id}`}>{pic(x, 40)}</span>)}</span>
        <span>{text}</span>
      </li>
    );
    switch (step.action) {
      case 'obtain':
        return row(
          [step.species],
          <>
            {step.have === 'ready' ? t('Use your') : t('Get a')}{' '}
            <span className="font-medium">
              {symbol(step.gender)}
              {name(step.species)}
            </span>
            .
          </>
        );
      case 'teach':
        return row(
          [step.species],
          step.method === 'level-up'
            ? step.level === 0
              ? t('{name} learns the move when it evolves (or relearn it from the moves menu).', { name: name(step.species) })
              : step.level === 1
                ? t('{name} knows the move from the start (relearn it from the moves menu if it was forgotten).', {
                    name: name(step.species),
                  })
                : t('Raise {name} to level {level} so it learns the move.', { name: name(step.species), level: step.level })
            : step.method === 'machine'
              ? t('Teach {name} the move with its TM.', { name: name(step.species) })
              : t('Teach {name} the move ({method}).', { name: name(step.species), method: step.method })
        );
      case 'breed':
        return row(
          [step.father, step.mother],
          <>
            {t('Breed')} <span className="font-medium">{name(step.father)} ♂</span> {t('with')}{' '}
            <span className="font-medium">{name(step.mother)} ♀</span>.{' '}
            {t('The {name} that hatches knows the move.', { name: name(step.offspring) })}
          </>
        );
      case 'picnic':
        return row(
          [step.to, step.from],
          <>
            {t('Give')} <span className="font-medium">{name(step.to)}</span>{' '}
            {t('a Mirror Herb and leave one move slot empty, then have a picnic with')}{' '}
            <span className="font-medium">{name(step.from)}</span> {t('in the party.')}
          </>
        );
    }
  };

  const pct = (x: number) => {
    const v = x * 100;
    return `${v >= 10 ? Math.round(v) : v >= 1 ? v.toFixed(1) : v.toFixed(2)}%`;
  };
  const statList = (stats: IvStat[]) => stats.map((s) => STAT_LABELS[s][lang]).join(', ');
  const sourceLabel = (p: ParentPick) =>
    p.source === 'breeder' ? t('from your breeders') : p.source === 'roster' ? t('from your roster') : t('from your Pokédex, IVs unknown');

  /** A parent to put in the nursery: the Pokémon chosen for it, whether you have it, and what it brings. */
  const renderParent = (goal: BreedingGoalView, role: string, pick: ParentPick | null, item: ShoppingItem | undefined) => {
    const species = pick?.species ?? item?.species;
    if (!species) return null;
    const have = item?.have ?? 'ready';
    const sex = pick ? (pick.gender === 'any' ? undefined : pick.gender) : item?.gender;
    return (
      <li key={role} className="rounded-lg border border-line p-3 text-xs">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{role}</p>
        <div className="flex items-center gap-2">
          {pic(species, 56)}
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {symbol(sex)}
              {pick?.label ?? name(species)}
              {pick?.label && <span className="text-xs font-normal text-muted"> · {name(species)}</span>}
            </p>
            {pick && (
              <p className="text-muted">
                {sourceLabel(pick)}
                {pick.perfect.length > 0 ? ` · ${t('perfect')}: ${statList(pick.perfect)}` : ''}
              </p>
            )}
          </div>
          <span
            className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              have === 'ready' ? 'bg-done/15 text-done' : have === 'caught' ? 'bg-star/15 text-star' : 'bg-pending/15 text-pending'
            }`}
          >
            {have === 'ready' ? t('Ready') : have === 'caught' ? t('Check it') : t('You need it')}
          </span>
        </div>
        {item && have !== 'ready' && (
          <p className={`mt-1 ${have === 'caught' ? 'text-star' : 'text-pending'}`}>{describe(goal, item)}</p>
        )}
      </li>
    );
  };

  const renderIvs = (goal: BreedingGoalView, ivs: IvPlan) => {
    const heading = (
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('What to expect from the egg')}</h4>
    );
    if (ivs.reason === 'no-breeding') return null;
    if (ivs.reason === 'no-base' || ivs.reason === 'no-partner' || !ivs.base || !ivs.partner) {
      return (
        <div className="mt-4">
          {heading}
          <p className="text-xs text-pending">
            {ivs.reason === 'no-partner'
              ? t('No partner to pair it with: you need a male that shares its egg group, or a Ditto. Record one in Breeders.')
              : t('No {name} (or one of its line) recorded as a female. Add it in Breeders or record it in the Pokédex.', {
                  name: name(goal.species),
                })}
          </p>
        </div>
      );
    }
    return (
      <div className="mt-4">
        {heading}
        {ivs.targets.length > 0 && (
          <p className="mt-2 text-xs">
            {t('Chance that all of {stats} come out perfect:', { stats: statList(ivs.targets) })}{' '}
            <span className="font-semibold text-star">{pct(ivs.chance.all)}</span>{' '}
            <span className="text-muted">
              ({t('about {n} of {total} on average', { n: ivs.chance.expected.toFixed(1), total: ivs.targets.length })})
            </span>
          </p>
        )}
        {ivs.gaps.length > 0 && (
          <p className="mt-1 text-xs text-pending">
            {t('Neither parent has a perfect {stats} recorded. Breed or catch one that does, or fix it afterwards with a Bottle Cap.', {
              stats: statList(ivs.gaps),
            })}
          </p>
        )}
        {ivs.unrecorded && (
          <p className="mt-1 text-xs text-muted">
            {t('One of these parents comes from the Pokédex, so its IVs are not known and the chance is a minimum. Record it in Breeders.')}
          </p>
        )}
        {ivs.natureOk === false && (
          <p className="mt-1 text-xs text-pending">
            {t('Neither parent has the nature you want. Breed without an Everstone and fix the effect with a Mint.')}
          </p>
        )}
        {ivs.hiddenOk === false && (
          <p className="mt-1 text-xs text-pending">
            {t('The mother does not have the hidden ability recorded. Use one that has it, or an Ability Patch afterwards.')}
          </p>
        )}
      </div>
    );
  };

  /** Everything to hold or have ready for a plan, from the moves, the IV pair and the hidden ability. */
  const renderBring = (goal: BreedingGoalView) => {
    const plan = goal.plan;
    if (!plan?.parents.canBreed) return null;
    const lines: string[] = [];
    const ivs = goal.ivs;
    if (ivs?.base && ivs.partner) {
      const who = (w: 'base' | 'partner' | null) => {
        const p = w === 'base' ? ivs.base : ivs.partner;
        return p ? (p.label ?? name(p.species)) : '';
      };
      lines.push(`${DESTINY_KNOT.name[lang]} ${t('(either parent holds it; 5 IVs are passed on instead of 3)')}`);
      if (ivs.items.powerItem) {
        lines.push(
          `${POWER_ITEMS[ivs.items.powerItem].name[lang]} ${t('on {name}, so its {stat} IV is always passed on', {
            name: who(ivs.items.powerHolder),
            stat: STAT_LABELS[ivs.items.powerItem][lang],
          })}`
        );
      }
      if (ivs.items.everstone) {
        lines.push(
          `${EVERSTONE.name[lang]} ${t('on {name}, so the egg gets its nature', { name: who(ivs.items.everstone) })}`
        );
      }
    }
    // A picnic is the plan's best way for at least one egg move.
    if (plan.moves.some((m) => m.kind === 'egg' && m.options[0]?.kind === 'mirror-herb')) {
      lines.push(
        `${MIRROR_HERB.name[lang]} ${t('on the Pokémon that gets the egg move, with a free move slot, for the picnic')}`
      );
    }
    if (goal.hiddenAbility && (!ivs?.base || ivs.hiddenOk !== true)) {
      lines.push(
        `${ABILITY_PATCH.name[lang]} ${t('after hatching, to give it the hidden ability (no hidden-ability mother needed)')}`
      );
    }
    const needsEgg =
      ivs?.base != null || plan.moves.some((m) => m.kind === 'egg' && m.options.some((o) => o.kind !== 'mirror-herb'));
    if (lines.length === 0 && !needsEgg) return null;
    return (
      <div className="mt-4 rounded-lg bg-surface-2 p-3 text-xs">
        <p className="font-medium">{t('Bring')}:</p>
        {lines.length > 0 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted">{t('No special items are needed for this plan.')}</p>
        )}
        {needsEgg && (
          <p className="mt-2 text-muted">{t('A sandwich with Egg Power at the picnic makes the eggs appear sooner.')}</p>
        )}
        <p className="mt-1 text-muted">{t('Find them in the Catalog (button at the bottom right).')}</p>
      </div>
    );
  };

  const renderMove = (goal: BreedingGoalView, plan: MovePlan) => (
    <div key={plan.moveId} className="rounded-lg border border-line p-3">
      <h4 className="text-sm font-semibold">{moveName(goal, plan.moveId)}</h4>
      {plan.kind === 'illegal' && (
        <p className="mt-1 text-xs text-red-400">{t('This Pokémon cannot have this move in this game.')}</p>
      )}
      {plan.kind === 'egg' && plan.options.length === 0 && (
        <p className="mt-1 text-xs text-pending">
          {t('This is an egg move, but no parent available in this game can pass it on.')}
        </p>
      )}
      {plan.options.map((option, i) => (
        <div key={i} className="mt-2">
          <p className="text-xs font-medium">
            {optionTitles[option.kind]}
            {option.ready && <span className="ml-2 rounded bg-done/15 px-1.5 py-0.5 text-[10px] text-done">{t('ready now')}</span>}
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs">{option.steps.map(renderStep)}</ol>
        </div>
      ))}
    </div>
  );

  /** Whether the parents of a plan are all at hand, in a few words for the list and the summary. */
  const readiness = (goal: BreedingGoalView) => {
    const plan = goal.plan;
    if (!plan) return { label: '', tone: 'text-muted', need: [] as ShoppingItem[] };
    if (!plan.parents.canBreed) return { label: t('Cannot breed'), tone: 'text-red-400', need: [] as ShoppingItem[] };
    const need = plan.shopping.filter((s) => s.have !== 'ready');
    return need.length === 0
      ? { label: t('Ready to breed'), tone: 'text-done', need }
      : { label: t('Missing {n}', { n: need.length }), tone: 'text-pending', need };
  };

  const renderGoal = (goal: BreedingGoalView) => {
    const plan = goal.plan;
    const state = readiness(goal);
    // The pair for the nursery: the specimens the IV plan chose, with their entry in the shopping list.
    const ivs = goal.ivs && goal.ivs.base && goal.ivs.partner ? goal.ivs : null;
    const motherPick = ivs?.base ?? null;
    const partnerPick = ivs?.partner ?? null;
    const shopping = plan?.shopping ?? [];
    const motherItem = shopping.find((s) => s.role === 'mother');
    const partnerItem = partnerPick
      ? shopping.find((s) => s.species.id === partnerPick.species.id && (s.role === 'father' || s.role === 'ditto'))
      : (shopping.find((s) => s.role === 'ditto') ?? shopping.find((s) => s.role === 'father'));
    // What is left (fathers that know a move, donors...), what is missing first.
    const others = shopping
      .filter((s) => s !== motherItem && s !== partnerItem)
      .sort((a, b) => Number(a.have === 'ready') - Number(b.have === 'ready'));
    const natural = plan?.moves.filter((m) => m.kind === 'natural') ?? [];
    return (
      <div
        className="rounded-xl border bg-surface p-4"
        style={{ borderColor: `${STAGE_COLOR[goal.status]}${goal.status === 'PLANNED' ? '55' : 'aa'}` }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {pic(goal.species, 64)}
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
              {name(goal.species)}
              <StageBadge status={goal.status} label={statusLabels[goal.status]} />
            </h3>
            {goal.moves.length > 0 && <p className="text-xs text-muted">{goal.moves.map(name).join(' · ')}</p>}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={goal.status}
              onChange={(e) => setStatus(goal.id, e.target.value as BreedingGoalView['status'])}
              aria-label={t('Plan status')}
              className="rounded-md border border-line bg-surface px-2 py-1"
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button onClick={() => setDeleting(goal)} className="text-muted hover:text-red-400">
              {t('Delete')}
            </button>
          </div>
        </div>

        {(goal.ivTargets.length > 0 || goal.nature || goal.hiddenAbility) && (
          <p className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {goal.ivTargets.map((s) => (
              <span key={s} className="rounded border border-done/50 bg-done/10 px-1.5 py-0.5 text-done">
                {STAT_LABELS[s][lang]} 31
              </span>
            ))}
            {goal.nature && <span className="rounded border border-line px-1.5 py-0.5">{name(goal.nature)}</span>}
            {goal.hiddenAbility && <span className="rounded border border-line px-1.5 py-0.5">{t('Hidden ability')}</span>}
          </p>
        )}

        {plan && !plan.parents.canBreed && (
          <p className="mt-3 text-sm text-red-400">
            {t('{name} cannot breed (it is in the "no eggs" group), so it has to be caught.', { name: name(goal.species) })}
          </p>
        )}

        {plan && plan.parents.canBreed && (
          <>
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
                state.need.length === 0 ? 'bg-done/10 text-done' : 'bg-pending/10 text-pending'
              }`}
            >
              {state.need.length === 0
                ? t('You have everything. Go breed!')
                : t('Still missing: {names}', { names: state.need.map((s) => name(s.species)).join(', ') })}
            </div>
            <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('1. Parents to put in the nursery')}
            </h4>
            <ul className="grid gap-2 sm:grid-cols-2">
              {renderParent(goal, t('Mother (the egg hatches as her species)'), motherPick, motherItem)}
              {renderParent(goal, partnerItem?.role === 'ditto' || partnerPick?.species.id === 132 ? t('Ditto') : t('Father'), partnerPick, partnerItem)}
            </ul>
            {others.length > 0 && (
              <>
                <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                  {t('2. Also needed for the moves')}
                </h4>
                <ul className="grid gap-2 xl:grid-cols-2">{others.map((s, i) => renderItem(goal, s, i))}</ul>
              </>
            )}
            <p className="mt-3 text-xs text-muted">
              {t('The egg hatches as')} <span className="text-ink">{name(plan.parents.hatchesAs)}</span>
              {plan.parents.needsDitto ? `. ${t('This Pokémon can only breed with Ditto.')}` : '.'}{' '}
              {t('This list updates itself from what you record in your Pokédex, roster and breeders.')}
            </p>
          </>
        )}

        {goal.ivs && plan?.parents.canBreed && renderIvs(goal, goal.ivs)}
        {renderBring(goal)}

        {plan && (natural.length > 0 || plan.moves.some((m) => m.kind !== 'natural')) && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('Moves')}</h4>
            {natural.length > 0 && (
              <p className="mb-2 text-xs text-muted">
                {t('No breeding needed for')}{' '}
                <span className="text-ink">{natural.map((m) => moveName(goal, m.moveId)).join(', ')}</span>:{' '}
                {natural.length > 1
                  ? t('{name} learns them normally.', { name: name(goal.species) })
                  : t('{name} learns it normally.', { name: name(goal.species) })}
              </p>
            )}
            <div className="grid gap-3 xl:grid-cols-2">
              {plan.moves.filter((m) => m.kind !== 'natural').map((m) => renderMove(goal, m))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setHatchOpen(true)}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          🥚 {t('Hatch eggs faster')}
        </button>
      </div>
      <HatchDialog open={hatchOpen} onClose={() => setHatchOpen(false)} gameId={gameId} lang={lang} picnic={picnic} />
      <form onSubmit={create} className="mb-6 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-[1.2fr_repeat(4,1fr)]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t('Pokémon you want')}</span>
            <ComboInput
              list="breed-species"
              value={target}
              onChange={onTargetChange}
              placeholder={t('e.g. Garchomp')}
              required
              className={inputClass}
            />
          </label>
          {wanted.map((value, i) => {
            const taken = new Set(wanted.filter((m, k) => m != null && k !== i));
            const list = (moves: Named[]) => moves.filter((m) => !taken.has(m.id));
            return (
              <label key={i} className="block">
                <span className="mb-1 block text-xs font-medium text-muted">{t('Move {n}', { n: i + 1 })}</span>
                <select
                  value={value ?? ''}
                  disabled={!options}
                  onChange={(e) => {
                    setFilledFromRoster(false);
                    setWanted((prev) => prev.map((w, k) => (k === i ? (e.target.value ? Number(e.target.value) : null) : w)));
                  }}
                  className={inputClass}
                >
                  <option value="">{options ? t('None') : t('Pick a Pokémon first')}</option>
                  {options && list(options.egg).length > 0 && (
                    <optgroup label={t('Egg moves (need breeding)')}>
                      {list(options.egg).map((m) => (
                        <option key={m.id} value={m.id}>
                          {name(m)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-muted">{t('IVs that must be 31 (Best)')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {IV_STATS.map((stat) => {
                const on = ivTargets.includes(stat);
                return (
                  <button
                    key={stat}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setIvTargets((prev) => (on ? prev.filter((s) => s !== stat) : [...prev, stat]))}
                    className={`rounded-md border px-2.5 py-1 text-xs ${
                      on ? 'border-done/60 bg-done/15 text-done' : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {STAT_LABELS[stat][lang]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t('Nature')}</span>
            <ComboInput
              list="breed-natures"
              value={natureText}
              onChange={setNatureText}
              placeholder={t('Any')}
              className={inputClass}
            />
          </label>
          <label
            className="flex items-end gap-2 pb-1.5 text-xs text-muted"
            title={t('The plan looks for a mother with the hidden ability recorded in Breeders. An Ability Patch is the alternative.')}
          >
            <input type="checkbox" checked={hiddenAbility} onChange={(e) => setHiddenAbility(e.target.checked)} />
            {t('Hidden ability')}
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          {!targetId
            ? t('Choose a Pokémon to see the egg moves it can get in this game.')
            : !options
              ? t('Loading its moves…')
              : [
                  filledFromRoster
                    ? t('Egg moves filled in from the build you are training in your roster.')
                    : options.egg.length === 0
                      ? t('This Pokémon has no egg moves in this game: everything it can have it learns normally.')
                      : t('{egg} egg moves this Pokémon can get from breeding. Pick the ones you want (up to 4); they are optional.', {
                          egg: options.egg.length,
                        }),
                  skipped > 0
                    ? t('{count} of its other moves are learned normally (or cannot be learned here), so they need no breeding and were left out.', { count: skipped })
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button disabled={busy} className="rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
            {busy ? t('Planning…') : t('Make a plan')}
          </button>
          {error && (
            <span role="alert" className="text-sm text-pending">
              {error}
            </span>
          )}
        </div>
        <datalist id="breed-natures">
          {natures.map((n) => (
            <option key={n.id} value={name(n)} label={lang === 'en' ? n.nameEs : n.nameEn} />
          ))}
        </datalist>
        <datalist id="breed-species">
          {species.map((s) => (
            <option key={s.id} value={name(s)} label={lang === 'en' ? s.nameEs : s.nameEn} />
          ))}
        </datalist>
      </form>

      {goals.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{t('No breeding plans yet. Create one above.')}</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-[calc(var(--nav-h)+1rem)] lg:max-h-[calc(100dvh-var(--nav-h)-2rem)] lg:self-start lg:overflow-y-auto">
            <ul className="space-y-1.5">
              {goals.map((goal) => {
                const on = goal.id === selected?.id;
                const state = readiness(goal);
                return (
                  <li key={goal.id}>
                    <button
                      type="button"
                      onClick={() => select(goal.id)}
                      aria-current={on ? 'true' : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${
                        on ? 'border-done bg-surface-2' : 'border-line bg-surface hover:bg-surface-2'
                      }`}
                      style={{ borderLeftColor: STAGE_COLOR[goal.status], borderLeftWidth: 4 }}
                    >
                      {pic(goal.species, 40)}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{name(goal.species)}</span>
                        {goal.moves.length > 0 && (
                          <span className="block truncate text-[11px] text-muted">{goal.moves.map(name).join(' · ')}</span>
                        )}
                        <span className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className={state.tone}>{state.label}</span>
                          <StageBadge status={goal.status} label={statusLabels[goal.status]} size="sm" />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div ref={detailRef} className="min-w-0 scroll-mt-16">
            {selected && renderGoal(selected)}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting != null}
        title={t('Delete this breeding plan?')}
        confirmLabel={t('Delete')}
        danger
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)}
      >
        <p>
          {t('The plan for {name} will be deleted. Your roster and Pokédex are not changed.', {
            name: deleting ? name(deleting.species) : '',
          })}
        </p>
      </ConfirmDialog>
    </div>
  );
}
