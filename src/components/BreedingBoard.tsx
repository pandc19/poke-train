'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LocationResult } from '@/lib/ai/schema';
import type { MoveOption, MovePlan, SpeciesRef, Step } from '@/lib/breeding/engine';
import type { BreedingGoalView } from '@/lib/breeding/goals';
import type { Lang } from '@/lib/i18n';

type Named = { id: number; nameEn: string; nameEs: string };
type Suggestion = { id: string; species: Named; pendingMoves: Named[] };
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

export function BreedingBoard({
  gameId,
  initial,
  species,
  moves,
  lang,
  aiEnabled,
  rosterSuggestions,
}: {
  gameId: string;
  initial: BreedingGoalView[];
  species: Named[];
  moves: Named[];
  lang: Lang;
  aiEnabled: boolean;
  rosterSuggestions: Suggestion[];
}) {
  const [goals, setGoals] = useState(initial);
  const [target, setTarget] = useState('');
  const [wanted, setWanted] = useState(['', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Record<number, LocationState>>({});

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const s = find(species, target);
    if (!s) {
      setError(`"${target}" is not a Pokémon available in this game. Pick one from the suggestions.`);
      return;
    }
    const moveIds: number[] = [];
    for (const text of wanted.filter((w) => w.trim())) {
      const move = find(moves, text);
      if (!move) {
        setError(`"${text}" is not a known move. Pick one from the suggestions.`);
        return;
      }
      moveIds.push(move.id);
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ goal: BreedingGoalView }>('/api/breeding', 'POST', { gameId, speciesId: s.id, moveIds });
      setGoals((prev) => [data.goal, ...prev]);
      setTarget('');
      setWanted(['', '', '', '']);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the plan.');
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, body: { status?: BreedingGoalView['status']; recompute?: boolean }) {
    setError(null);
    try {
      const data = await api<{ goal: BreedingGoalView }>(`/api/breeding/${id}`, 'PATCH', body);
      setGoals((prev) => prev.map((g) => (g.id === id ? data.goal : g)));
    } catch {
      setError('Could not update that plan. Try again.');
    }
  }

  async function remove(goal: BreedingGoalView) {
    if (!window.confirm(`Delete the breeding plan for ${name(goal.species)}?`)) return;
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

  function prefill(id: string) {
    const suggestion = rosterSuggestions.find((r) => r.id === id);
    if (!suggestion) return;
    setTarget(name(suggestion.species));
    setWanted([0, 1, 2, 3].map((i) => (suggestion.pendingMoves[i] ? name(suggestion.pendingMoves[i]) : '')));
  }

  const renderStep = (step: Step, key: number) => {
    switch (step.action) {
      case 'obtain': {
        const who = `${step.gender ? `${step.gender} ` : ''}${name(step.species)}`;
        const location = locations[step.species.id];
        if (step.have === 'ready') {
          return (
            <li key={key} className="text-done">
              ✓ You have a {name(step.species)} for this
              {step.gender === 'male' ? ' (it must be male)' : ''}.
            </li>
          );
        }
        return (
          <li key={key}>
            <span className={step.have === 'caught' ? 'text-star' : 'text-pending'}>
              {step.have === 'caught'
                ? `You have caught ${name(step.species)} before: use a ${who}, or catch one.`
                : `Catch a ${who}.`}
            </span>{' '}
            <button
              onClick={() => locate(step.species)}
              disabled={!aiEnabled || location?.busy}
              title={aiEnabled ? 'Researched on the web with AI' : 'Add an API key to .env.local to enable location lookups'}
              className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink disabled:opacity-40"
            >
              {location?.busy ? 'Searching…' : 'Where?'}
            </button>
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
      }
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

  const renderMove = (plan: MovePlan, move: Named | undefined) => (
    <div key={plan.moveId} className="rounded-lg border border-line p-3">
      <h4 className="text-sm font-semibold">{move ? name(move) : `Move #${plan.moveId}`}</h4>
      {plan.kind === 'natural' && plan.natural && (
        <p className="mt-1 text-xs text-done">
          No breeding needed:{' '}
          {plan.natural.method === 'level-up'
            ? plan.natural.level === 0
              ? `${name(plan.natural.species)} learns it when it evolves.`
              : `${name(plan.natural.species)} learns it at level ${plan.natural.level}.`
            : plan.natural.method === 'machine'
              ? `${name(plan.natural.species)} learns it from a TM.`
              : `${name(plan.natural.species)} learns it by ${plan.natural.method}.`}
        </p>
      )}
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
          <input
            list="breed-species"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Pokémon to breed"
            aria-label="Pokémon to breed"
            required
            className={inputClass}
          />
          {wanted.map((value, i) => (
            <input
              key={i}
              list="breed-moves"
              value={value}
              onChange={(e) => setWanted((prev) => prev.map((w, k) => (k === i ? e.target.value : w)))}
              placeholder={`Wanted move ${i + 1}`}
              aria-label={`Wanted move ${i + 1}`}
              className={inputClass}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button disabled={busy} className="rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
            {busy ? 'Planning…' : 'Plan breeding'}
          </button>
          {rosterSuggestions.length > 0 && (
            <select
              value=""
              onChange={(e) => prefill(e.target.value)}
              aria-label="Fill in from a roster Pokémon with pending moves"
              className="rounded-md border border-line bg-surface px-2 py-2 text-sm text-muted"
            >
              <option value="">Fill in from roster (pending moves)…</option>
              {rosterSuggestions.map((r) => (
                <option key={r.id} value={r.id}>
                  {name(r.species)}: {r.pendingMoves.map(name).join(', ')}
                </option>
              ))}
            </select>
          )}
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
        <datalist id="breed-moves">
          {moves.map((m) => (
            <option key={m.id} value={name(m)} />
          ))}
        </datalist>
      </form>

      {goals.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No breeding plans yet. Create one above.</p>
      ) : (
        <ul className="space-y-4">
          <AnimatePresence initial={false}>
            {goals.map((goal) => (
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
                  <span className="text-xs text-muted">{goal.moves.map(name).join(' · ')}</span>
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    <select
                      value={goal.status}
                      onChange={(e) => update(goal.id, { status: e.target.value as BreedingGoalView['status'] })}
                      aria-label="Plan status"
                      className="rounded-md border border-line bg-surface px-2 py-1"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => update(goal.id, { recompute: true })}
                      title="Rebuild against your current roster and Pokédex"
                      className="rounded-md border border-line px-2 py-1"
                    >
                      Recheck
                    </button>
                    <button onClick={() => remove(goal)} className="text-muted hover:text-red-400">
                      Delete
                    </button>
                  </div>
                </div>

                {goal.plan && (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-line p-3">
                      <h4 className="text-sm font-semibold">Parents</h4>
                      {goal.plan.parents.canBreed ? (
                        <>
                          <p className="mt-1 text-xs text-muted">
                            The egg hatches as {name(goal.plan.parents.hatchesAs)}.
                            {goal.plan.parents.needsDitto
                              ? ' This Pokémon can only breed with Ditto.'
                              : ' The mother decides the species; any compatible male or a Ditto can be the other parent.'}
                          </p>
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                            {goal.plan.parents.steps.map(renderStep)}
                          </ol>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-red-400">
                          {name(goal.species)} cannot breed (it is in the &quot;no eggs&quot; group). It has to be
                          caught.
                        </p>
                      )}
                    </div>
                    {goal.plan.moves.map((m) => renderMove(m, goal.moves.find((x) => x.id === m.moveId)))}
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
