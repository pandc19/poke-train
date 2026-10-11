import { describe, expect, it } from 'vitest';
import { rosterProgress, rosterTasks, type RosterTaskSource } from '@/lib/roster-status';

const base: RosterTaskSource = {
  owned: true,
  targetNatureId: 1,
  natureStatus: 'DONE',
  abilityId: 1,
  abilityStatus: 'DONE',
  itemId: 1,
  itemNote: null,
  itemStatus: 'DONE',
  evs: null,
  evStatus: 'PENDING',
  moves: [
    { slot: 2, moveId: 2, rawName: null, status: 'DONE' },
    { slot: 1, moveId: 1, rawName: null, status: 'DONE' },
  ],
};

describe('roster status engine', () => {
  it('is complete only when every applicable task is done', () => {
    expect(rosterProgress(base)).toEqual({ done: 6, total: 6, complete: true });
    expect(rosterProgress({ ...base, itemStatus: 'PENDING' }).complete).toBe(false);
  });
  it('ignores aspects with no target (EVs not planned are not a task)', () => {
    expect(rosterTasks(base).some((t) => t.key === 'evs')).toBe(false);
    expect(rosterTasks({ ...base, evs: { attack: 252 } }).find((t) => t.key === 'evs')?.status).toBe('PENDING');
  });
  it('counts obtaining the Pokémon and unmatched moves as tasks', () => {
    const p = { ...base, owned: false, moves: [{ slot: 1, moveId: null, rawName: 'Cuerpo Cósmico', status: 'PENDING' as const }] };
    expect(rosterProgress(p)).toMatchObject({ done: 3, total: 5, complete: false });
  });
  it('orders move tasks by slot', () => {
    expect(rosterTasks(base).filter((t) => t.key.startsWith('move')).map((t) => t.key)).toEqual(['move:1', 'move:2']);
  });
});
