'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ConfirmDialog } from './Dialog';
import { ComboInput } from './roster/parts';
import { useCachedLocations } from './useCachedLocations';
import { STAT_LABELS } from './EvInputs';
import type { LocationResult } from '@/lib/ai/schema';
import { IV_STATS, type IvStat, type MoveOption, type MovePlan, type ShoppingItem, type SpeciesRef, type Step } from '@/lib/breeding/engine';
import type { BreedingGoalView } from '@/lib/breeding/goals';
import { DESTINY_KNOT, EVERSTONE, POWER_ITEMS } from '@/lib/breeding/items';
import type { IvPlan, ParentPick } from '@/lib/breeding/ivs';
import type { Lang } from '@/lib/i18n';
import { useT } from '@/lib/translate-client';

type Named = { id: number; nameEn: string; nameEs: string };
type RosterBuild = { speciesId: number; species: Named; moves: Named[] };
type LocationState = { busy: boolean; result?: LocationResult; error?: string };

const inputClass = 'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm placeholder:text-muted';
const symbol = (g?: 'male' | 'female') => (g === 'male' ? '♂ ' : g === 'female' ? '♀ ' : '');

export function BreedingBoard({
  gameId,
  initial,
  species,
  natures,
  lang,
  aiEnabled,
  rosterBuilds,
}: {
  gameId: string;
  initial: BreedingGoalView[];
  species: Named[];
  natures: Named[];
  lang: Lang;
  aiEnabled: boolean;
  rosterBuilds: RosterBuild[];
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
        const legal = new Set([...data.egg, ...data.other].map((m) => m.id));
        const usable = build.moves.map((m) => m.id).filter((id) => legal.has(id)).slice(0, 4);
        setWanted([0, 1, 2, 3].map((i) => usable[i] ?? null));
        setSkipped(build.moves.length - usable.length);
        setFilledFromRoster(true);
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
        <p className="text-sm font-semibold">
          {symbol(item.gender)}
          {name(item.species)} <span className="text-xs font-normal text-muted">· {roleLabel(goal, item)}</span>
        </p>
        <p className={item.have === 'ready' ? 'text-done' : item.have === 'caught' ? 'text-star' : 'text-pending'}>
          {describe(goal, item)}
        </p>
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
            <p className="mt-1 text-[10px]">{t('AI-researched. Check in game before relying on it.')}</p>
          </div>
        )}
      </li>
    );
  };

  const renderStep = (step: Step, key: number) => {
    switch (step.action) {
      case 'obtain':
        return (
          <li key={key}>
            {step.have === 'ready' ? t('Use your') : t('Get a')}{' '}
            <span className="font-medium">
              {symbol(step.gender)}
              {name(step.species)}
            </span>
            .
          </li>
        );
      case 'teach':
        return (
          <li key={key}>
            {step.method === 'level-up'
              ? step.level === 0
                ? t('{name} learns the move when it evolves (or relearn it from the moves menu).', { name: name(step.species) })
                : step.level === 1
                  ? t('{name} knows the move from the start (relearn it from the moves menu if it was forgotten).', {
                      name: name(step.species),
                    })
                  : t('Raise {name} to level {level} so it learns the move.', { name: name(step.species), level: step.level })
              : step.method === 'machine'
                ? t('Teach {name} the move with its TM.', { name: name(step.species) })
                : t('Teach {name} the move ({method}).', { name: name(step.species), method: step.method })}
          </li>
        );
      case 'breed':
        return (
          <li key={key}>
            {t('Breed')} <span className="font-medium">{name(step.father)} ♂</span> {t('with')}{' '}
            <span className="font-medium">{name(step.mother)} ♀</span>.{' '}
            {t('The {name} that hatches knows the move.', { name: name(step.offspring) })}
          </li>
        );
      case 'picnic':
        return (
          <li key={key}>
            {t('Give')} <span className="font-medium">{name(step.to)}</span>{' '}
            {t('a Mirror Herb and leave one move slot empty, then have a picnic with')}{' '}
            <span className="font-medium">{name(step.from)}</span> {t('in the party.')}
          </li>
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

  const renderPick = (p: ParentPick, role: string) => (
    <li key={role} className="rounded-lg border border-line p-2">
      <p className="text-sm font-semibold">
        {p.gender === 'female' ? '♀ ' : p.gender === 'male' ? '♂ ' : ''}
        {p.label ?? name(p.species)}
        {p.label && <span className="text-xs font-normal text-muted"> · {name(p.species)}</span>}
        <span className="text-xs font-normal text-muted"> · {role}</span>
      </p>
      <p className="text-muted">
        {sourceLabel(p)}
        {p.perfect.length > 0 && ` · ${t('perfect')}: ${statList(p.perfect)}`}
      </p>
    </li>
  );

  const renderIvs = (goal: BreedingGoalView, ivs: IvPlan) => {
    const heading = (
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('Best parents for the IVs')}</h4>
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
    const powerStat = ivs.items.powerItem;
    const holder = (who: 'base' | 'partner' | null) => (who === 'base' ? ivs.base : ivs.partner);
    const holderName = (who: 'base' | 'partner' | null) => {
      const p = holder(who);
      return p ? (p.label ?? name(p.species)) : '';
    };
    return (
      <div className="mt-4">
        {heading}
        <ul className="grid gap-2 text-xs sm:grid-cols-2">
          {renderPick(ivs.base, t('the egg takes its species'))}
          {renderPick(ivs.partner, ivs.partner.species.id === 132 ? t('Ditto') : t('father'))}
        </ul>
        <div className="mt-2 rounded-lg bg-surface-2 p-3 text-xs">
          <p className="font-medium">{t('Bring')}:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>
              {DESTINY_KNOT.name[lang]} {t('(either parent holds it; 5 IVs are passed on instead of 3)')}
            </li>
            {powerStat && (
              <li>
                {POWER_ITEMS[powerStat].name[lang]} {t('on {name}, so its {stat} IV is always passed on', {
                  name: holderName(ivs.items.powerHolder),
                  stat: STAT_LABELS[powerStat][lang],
                })}
              </li>
            )}
            {ivs.items.everstone && (
              <li>
                {EVERSTONE.name[lang]} {t('on {name}, so the egg gets its nature', { name: holderName(ivs.items.everstone) })}
              </li>
            )}
          </ul>
          <p className="mt-2 text-muted">{t('Find them in the Catalog (button at the bottom right).')}</p>
        </div>
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

  return (
    <div>
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
                  {options && list(options.other).length > 0 && (
                    <optgroup label={t('Learned normally')}>
                      {list(options.other).map((m) => (
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
          <label className="flex items-end gap-2 pb-1.5 text-xs text-muted">
            <input type="checkbox" checked={hiddenAbility} onChange={(e) => setHiddenAbility(e.target.checked)} />
            {t('Hidden ability')}
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          {!targetId
            ? t('Choose a Pokémon to see the moves it can have in this game.')
            : !options
              ? t('Loading its moves…')
              : filledFromRoster
                ? `${t('Moves filled in from the build you are training in your roster.')}${
                    skipped > 0
                      ? ` ${t('{count} of them cannot be learned by this Pokémon in this game, so they were left out.', { count: skipped })}`
                      : ''
                  }`
                : t('{egg} egg moves (these need breeding) and {other} it learns normally. Moves are optional.', {
                    egg: options.egg.length,
                    other: options.other.length,
                  })}
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
        <ul className="space-y-4">
          <AnimatePresence initial={false}>
            {goals.map((goal) => {
              const plan = goal.plan;
              const have = plan?.shopping.filter((s) => s.have === 'ready') ?? [];
              const need = plan?.shopping.filter((s) => s.have !== 'ready') ?? [];
              const natural = plan?.moves.filter((m) => m.kind === 'natural') ?? [];
              return (
                <motion.li
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-xl border bg-surface p-4 ${goal.status === 'DONE' ? 'border-done/60' : 'border-line'}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold">{name(goal.species)}</h3>
                    {goal.moves.length > 0 && <span className="text-xs text-muted">{goal.moves.map(name).join(' · ')}</span>}
                    <div className="ml-auto flex items-center gap-2 text-xs">
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
                      {goal.nature && (
                        <span className="rounded border border-line px-1.5 py-0.5">{name(goal.nature)}</span>
                      )}
                      {goal.hiddenAbility && (
                        <span className="rounded border border-line px-1.5 py-0.5">{t('Hidden ability')}</span>
                      )}
                    </p>
                  )}

                  {plan && !plan.parents.canBreed && (
                    <p className="mt-3 text-sm text-red-400">
                      {t('{name} cannot breed (it is in the "no eggs" group), so it has to be caught.', {
                        name: name(goal.species),
                      })}
                    </p>
                  )}

                  {plan && plan.parents.canBreed && (
                    <>
                      <p className="mt-2 text-xs text-muted">
                        {t('The egg hatches as')} <span className="text-ink">{name(plan.parents.hatchesAs)}</span>
                        {plan.parents.needsDitto ? `. ${t('This Pokémon can only breed with Ditto.')}` : '.'}{' '}
                        {t('This list updates itself from the genders you record in your Pokédex and roster.')}
                      </p>
                      <div className="mt-3 grid gap-4 lg:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-done">
                            {t('You have')} ({have.length})
                          </h4>
                          {have.length ? (
                            <ul className="space-y-2">{have.map((s, i) => renderItem(goal, s, i))}</ul>
                          ) : (
                            <p className="text-xs text-muted">{t('Nothing usable yet.')}</p>
                          )}
                        </div>
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pending">
                            {t('You still need')} ({need.length})
                          </h4>
                          {need.length ? (
                            <ul className="space-y-2">{need.map((s, i) => renderItem(goal, s, i))}</ul>
                          ) : (
                            <p className="text-xs text-done">{t('You have everything. Go breed!')}</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {goal.ivs && plan?.parents.canBreed && renderIvs(goal, goal.ivs)}

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
                      <div className="grid gap-3 lg:grid-cols-2">
                        {plan.moves.filter((m) => m.kind !== 'natural').map((m) => renderMove(goal, m))}
                      </div>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
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
