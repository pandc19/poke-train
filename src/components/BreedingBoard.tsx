'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ConfirmDialog } from './Dialog';
import type { LocationResult } from '@/lib/ai/schema';
import type { MoveOption, MovePlan, ShoppingItem, SpeciesRef, Step } from '@/lib/breeding/engine';
import type { BreedingGoalView } from '@/lib/breeding/goals';
import type { Lang } from '@/lib/i18n';

type Named = { id: number; nameEn: string; nameEs: string };
type RosterBuild = { speciesId: number; species: Named; moves: Named[] };
type LocationState = { busy: boolean; result?: LocationResult; error?: string };

const OPTION_TITLES: Record<MoveOption['kind'], string> = {
  'mirror-herb': 'Mirror Herb picnic (no egg needed)',
  breed: 'Breed with a father that knows it',
  chain: 'Chain breeding (several generations)',
};

const STATUS_LABELS: Record<BreedingGoalView['status'], string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

const inputClass = 'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm placeholder:text-muted';
const symbol = (g?: 'male' | 'female') => (g === 'male' ? '♂ ' : g === 'female' ? '♀ ' : '');

export function BreedingBoard({
  gameId,
  initial,
  species,
  lang,
  aiEnabled,
  rosterBuilds,
}: {
  gameId: string;
  initial: BreedingGoalView[];
  species: Named[];
  lang: Lang;
  aiEnabled: boolean;
  rosterBuilds: RosterBuild[];
}) {
  const [goals, setGoals] = useState(initial);
  const [target, setTarget] = useState('');
  /** One move id (or none) per slot, chosen from the moves the Pokémon can have. */
  const [wanted, setWanted] = useState<(number | null)[]>([null, null, null, null]);
  const [options, setOptions] = useState<{ egg: Named[]; other: Named[] } | null>(null);
  const [filledFromRoster, setFilledFromRoster] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Record<number, LocationState>>({});
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
    if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
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
        if (err?.name !== 'AbortError') setError('Could not load the moves for that Pokémon. Try again.');
      });
    return () => controller.abort();
  }, [targetId, gameId, rosterBuilds]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const s = find(species, target);
    if (!s) {
      setError(`"${target}" is not a Pokémon available in this game. Pick one from the suggestions.`);
      return;
    }
    const moveIds = wanted.filter((m): m is number => m != null);
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ goal: BreedingGoalView }>('/api/breeding', 'POST', { gameId, speciesId: s.id, moveIds });
      setGoals((prev) => [data.goal, ...prev]);
      setTarget('');
      setWanted([null, null, null, null]);
      setOptions(null);
      setFilledFromRoster(false);
      setSkipped(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the plan.');
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
      setError('Could not update that plan. Try again.');
    }
  }

  async function remove(goal: BreedingGoalView) {
    setDeleting(null);
    try {
      await api(`/api/breeding/${goal.id}`, 'DELETE');
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    } catch {
      setError('Could not delete that plan. Try again.');
    }
  }

  async function locate(s: SpeciesRef) {
    setLocations((prev) => ({ ...prev, [s.id]: { busy: true } }));
    try {
      const data = await api<{ result: LocationResult }>('/api/ai/location', 'POST', { gameId, speciesId: s.id });
      setLocations((prev) => ({ ...prev, [s.id]: { busy: false, result: data.result } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lookup failed.';
      setLocations((prev) => ({ ...prev, [s.id]: { busy: false, error: message } }));
    }
  }

  const moveName = (goal: BreedingGoalView, id?: number) => {
    const m = goal.moves.find((x) => x.id === id);
    return m ? name(m) : 'the move';
  };

  const describe = (goal: BreedingGoalView, item: ShoppingItem): string => {
    const forMove = moveName(goal, item.forMoveId);
    if (item.have === 'ready') {
      if (item.role === 'mother') return 'You have a female. She will be the mother.';
      if (item.role === 'father') return `You have a male that knows ${forMove}.`;
      return 'You have it.';
    }
    if (item.have === 'caught') {
      if (item.role === 'father') {
        return `You have it, but either its gender is not recorded or it does not know ${forMove}. Record the gender in your Pokédex, or teach it ${forMove}.`;
      }
      if (item.role === 'mother') return 'You have caught this line, but not a recorded female. Record her gender in your Pokédex or roster.';
      return 'You have caught it, but it does not know the move yet.';
    }
    if (item.wrongGender) {
      return `You only have the other gender registered. You need a ${item.gender ?? 'matching'} one.`;
    }
    return 'You do not have this yet.';
  };

  const roleLabel = (goal: BreedingGoalView, item: ShoppingItem) => {
    if (item.role === 'mother') return 'mother (the egg hatches as her species)';
    if (item.role === 'ditto') return 'Ditto (the other parent)';
    if (item.role === 'father') return `father, passes down ${moveName(goal, item.forMoveId)}`;
    return `knows ${moveName(goal, item.forMoveId)}, shares it at a picnic`;
  };

  const renderItem = (goal: BreedingGoalView, item: ShoppingItem, key: number) => {
    const location = locations[item.species.id];
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
            onClick={() => locate(item.species)}
            disabled={!aiEnabled || location?.busy}
            title={aiEnabled ? 'Researched on the web with AI' : 'Add an API key to .env.local to enable location lookups'}
            className="mt-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink disabled:opacity-40"
          >
            {location?.busy ? 'Searching…' : 'Where do I catch it?'}
          </button>
        )}
        {location?.error && <p className="mt-1 text-pending">{location.error}</p>}
        {location?.result && (
          <div className="mt-1 rounded bg-surface-2 p-2 text-muted">
            {location.result.locations.map((l, i) => (
              <p key={i}>
                <span className="font-medium text-ink">{l.place}</span> · {l.details}
              </p>
            ))}
            {location.result.notes && <p className="mt-1">{location.result.notes}</p>}
            <p className="mt-1 text-[10px]">AI-researched. Check in game before relying on it.</p>
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
            {step.have === 'ready' ? 'Use your ' : 'Get a '}
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
                ? `${name(step.species)} learns the move when it evolves (or relearn it from the moves menu).`
                : step.level === 1
                  ? `${name(step.species)} knows the move from the start (relearn it from the moves menu if it was forgotten).`
                  : `Raise ${name(step.species)} to level ${step.level} so it learns the move.`
              : step.method === 'machine'
                ? `Teach ${name(step.species)} the move with its TM.`
                : `Teach ${name(step.species)} the move (${step.method}).`}
          </li>
        );
      case 'breed':
        return (
          <li key={key}>
            Breed <span className="font-medium">{name(step.father)} ♂</span> with{' '}
            <span className="font-medium">{name(step.mother)} ♀</span>. The {name(step.offspring)} that hatches knows
            the move.
          </li>
        );
      case 'picnic':
        return (
          <li key={key}>
            Give <span className="font-medium">{name(step.to)}</span> a Mirror Herb and leave one move slot empty,
            then have a picnic with <span className="font-medium">{name(step.from)}</span> in the party.
          </li>
        );
    }
  };

  const renderMove = (goal: BreedingGoalView, plan: MovePlan) => (
    <div key={plan.moveId} className="rounded-lg border border-line p-3">
      <h4 className="text-sm font-semibold">{moveName(goal, plan.moveId)}</h4>
      {plan.kind === 'illegal' && (
        <p className="mt-1 text-xs text-red-400">This Pokémon cannot have this move in this game.</p>
      )}
      {plan.kind === 'egg' && plan.options.length === 0 && (
        <p className="mt-1 text-xs text-pending">
          This is an egg move, but no parent available in this game can pass it on.
        </p>
      )}
      {plan.options.map((option, i) => (
        <div key={i} className="mt-2">
          <p className="text-xs font-medium">
            {OPTION_TITLES[option.kind]}
            {option.ready && <span className="ml-2 rounded bg-done/15 px-1.5 py-0.5 text-[10px] text-done">ready now</span>}
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
            <span className="mb-1 block text-xs font-medium text-muted">Pokémon you want</span>
            <input
              list="breed-species"
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              placeholder="e.g. Garchomp"
              required
              className={inputClass}
            />
          </label>
          {wanted.map((value, i) => {
            const taken = new Set(wanted.filter((m, k) => m != null && k !== i));
            const list = (moves: Named[]) => moves.filter((m) => !taken.has(m.id));
            return (
              <label key={i} className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Move {i + 1}</span>
                <select
                  value={value ?? ''}
                  disabled={!options}
                  onChange={(e) => {
                    setFilledFromRoster(false);
                    setWanted((prev) => prev.map((w, k) => (k === i ? (e.target.value ? Number(e.target.value) : null) : w)));
                  }}
                  className={inputClass}
                >
                  <option value="">{options ? 'None' : 'Pick a Pokémon first'}</option>
                  {options && list(options.egg).length > 0 && (
                    <optgroup label="Egg moves (need breeding)">
                      {list(options.egg).map((m) => (
                        <option key={m.id} value={m.id}>
                          {name(m)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {options && list(options.other).length > 0 && (
                    <optgroup label="Learned normally">
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
        <p className="mt-2 text-xs text-muted">
          {!targetId
            ? 'Choose a Pokémon to see the moves it can have in this game.'
            : !options
              ? 'Loading its moves…'
              : filledFromRoster
                ? `Moves filled in from the build you are training in your roster.${
                    skipped > 0 ? ` ${skipped} of them cannot be learned by this Pokémon in this game, so they were left out.` : ''
                  }`
                : `${options.egg.length} egg moves (these need breeding) and ${options.other.length} it learns normally. Moves are optional.`}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button disabled={busy} className="rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
            {busy ? 'Planning…' : 'Make a plan'}
          </button>
          {error && (
            <span role="alert" className="text-sm text-pending">
              {error}
            </span>
          )}
        </div>
        <datalist id="breed-species">
          {species.map((s) => (
            <option key={s.id} value={name(s)} />
          ))}
        </datalist>
      </form>

      {goals.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No breeding plans yet. Create one above.</p>
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
                        aria-label="Plan status"
                        className="rounded-md border border-line bg-surface px-2 py-1"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => setDeleting(goal)} className="text-muted hover:text-red-400">
                        Delete
                      </button>
                    </div>
                  </div>

                  {plan && !plan.parents.canBreed && (
                    <p className="mt-3 text-sm text-red-400">
                      {name(goal.species)} cannot breed (it is in the &quot;no eggs&quot; group), so it has to be
                      caught.
                    </p>
                  )}

                  {plan && plan.parents.canBreed && (
                    <>
                      <p className="mt-2 text-xs text-muted">
                        The egg hatches as <span className="text-ink">{name(plan.parents.hatchesAs)}</span>
                        {plan.parents.needsDitto ? '. This Pokémon can only breed with Ditto.' : '.'} This list updates
                        itself from the genders you record in your Pokédex and roster.
                      </p>
                      <div className="mt-3 grid gap-4 lg:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-done">
                            You have ({have.length})
                          </h4>
                          {have.length ? (
                            <ul className="space-y-2">{have.map((s, i) => renderItem(goal, s, i))}</ul>
                          ) : (
                            <p className="text-xs text-muted">Nothing usable yet.</p>
                          )}
                        </div>
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pending">
                            You still need ({need.length})
                          </h4>
                          {need.length ? (
                            <ul className="space-y-2">{need.map((s, i) => renderItem(goal, s, i))}</ul>
                          ) : (
                            <p className="text-xs text-done">You have everything. Go breed!</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {plan && (natural.length > 0 || plan.moves.some((m) => m.kind !== 'natural')) && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Moves</h4>
                      {natural.length > 0 && (
                        <p className="mb-2 text-xs text-muted">
                          No breeding needed for{' '}
                          <span className="text-ink">{natural.map((m) => moveName(goal, m.moveId)).join(', ')}</span>:{' '}
                          {name(goal.species)} learns {natural.length > 1 ? 'them' : 'it'} normally.
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
        title="Delete this breeding plan?"
        confirmLabel="Delete"
        danger
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)}
      >
        <p>
          The plan for <strong className="text-ink">{deleting ? name(deleting.species) : ''}</strong> will be deleted.
          Your roster and Pokédex are not changed.
        </p>
      </ConfirmDialog>
    </div>
  );
}
