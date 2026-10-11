'use client';

import { useState } from 'react';
import type { StarterAdvice as Advice } from '@/lib/ai/schema';

/** On-demand AI advice for the starter-team page. */
export function StarterAdvice({ gameId, aiEnabled }: { gameId: string; aiEnabled: boolean }) {
  const [state, setState] = useState<{ busy: boolean; result?: Advice; error?: string }>({ busy: false });

  async function run(refresh: boolean) {
    setState((prev) => ({ ...prev, busy: true, error: undefined }));
    try {
      const res = await fetch('/api/ai/starter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, refresh }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setState({ busy: false, result: data.result });
    } catch (error) {
      setState((prev) => ({ ...prev, busy: false, error: error instanceof Error ? error.message : 'Request failed.' }));
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">Adapt this to what I own</h2>
        <button
          onClick={() => run(state.result != null)}
          disabled={!aiEnabled || state.busy}
          className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {state.busy ? 'Thinking…' : state.result ? 'Ask again' : 'Ask AI'}
        </button>
        {!aiEnabled && <span className="text-xs text-muted">Add an API key to .env.local to enable this.</span>}
      </div>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-pending">
          {state.error}
        </p>
      )}
      {state.result && (
        <div className="mt-3 text-sm">
          <p>{state.result.summary}</p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {state.result.picks.map((pick, i) => (
              <li key={i} className="rounded-lg border border-line p-3 text-xs">
                <p className="text-sm font-semibold">{pick.pokemon}</p>
                <p className="text-muted">{pick.role}</p>
                <p className="mt-1">{pick.why}</p>
                <p className="mt-1 text-muted">{pick.whereToGet}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-muted">AI-generated. Check locations in game before relying on them.</p>
        </div>
      )}
    </section>
  );
}
