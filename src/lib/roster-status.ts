/**
 * The pending/complete status engine. A roster Pokémon is a checklist of
 * micro-tasks (obtain it, nature, ability, item, EVs, each move); it turns
 * green only when every task that applies to it is DONE.
 */
export type TaskStatus = 'PENDING' | 'DONE';

export type TaskKey = 'owned' | 'nature' | 'ability' | 'item' | 'evs' | `move:${number}`;

export type RosterTaskSource = {
  owned: boolean;
  targetNatureId: number | null;
  natureStatus: TaskStatus;
  abilityId: number | null;
  abilityStatus: TaskStatus;
  itemId: number | null;
  itemNote: string | null;
  itemStatus: TaskStatus;
  evs: unknown;
  evStatus: TaskStatus;
  moves: { slot: number; moveId: number | null; rawName: string | null; status: TaskStatus }[];
};

export type RosterTask = { key: TaskKey; status: TaskStatus };

/** The tasks that apply to this Pokémon. Aspects with no target set are not tasks. */
export function rosterTasks(p: RosterTaskSource): RosterTask[] {
  const tasks: RosterTask[] = [{ key: 'owned', status: p.owned ? 'DONE' : 'PENDING' }];
  if (p.targetNatureId != null) tasks.push({ key: 'nature', status: p.natureStatus });
  if (p.abilityId != null) tasks.push({ key: 'ability', status: p.abilityStatus });
  if (p.itemId != null || p.itemNote) tasks.push({ key: 'item', status: p.itemStatus });
  if (p.evs != null) tasks.push({ key: 'evs', status: p.evStatus });
  for (const m of [...p.moves].sort((a, b) => a.slot - b.slot)) {
    if (m.moveId != null || m.rawName) tasks.push({ key: `move:${m.slot}`, status: m.status });
  }
  return tasks;
}

export function rosterProgress(p: RosterTaskSource): { done: number; total: number; complete: boolean } {
  const tasks = rosterTasks(p);
  const done = tasks.filter((t) => t.status === 'DONE').length;
  return { done, total: tasks.length, complete: done === tasks.length };
}
