import { describe, expect, it } from 'vitest';
import { auditSuggestions } from '@/lib/audit-compare';

const now = { item: null, moves: [], tera: null, mintGiven: null, realNature: null, evs: null };

describe('nature suggestion', () => {
  const audit = { nature: { nature: 'Jolly', reason: 'Fast physical attacker.' } };

  it('is offered while the Pokémon has no nature on record', () => {
    expect(auditSuggestions(audit, now).nature).toEqual({ nature: 'Jolly', reason: 'Fast physical attacker.', same: false });
  });

  it('matches once that nature is the one it has or aims for', () => {
    expect(auditSuggestions(audit, { ...now, realNature: 'jolly' }).nature?.same).toBe(true);
  });

  it('is absent from audits that did not ask for it', () => {
    expect(auditSuggestions({}, now).nature).toBeUndefined();
  });
});
