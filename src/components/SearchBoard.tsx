'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PokemonSprite, ComboInput } from './roster/parts';
import { TypeBadge } from './TypeBadge';
import type { Lang } from '@/lib/i18n';
import type { RosterView } from '@/lib/roster';
import { useT } from '@/lib/translate-client';

type MoveRef = { id: number; nameEn: string; nameEs: string; type: string };

/** What a search can ask for. Only moves for now: add a kind here and to `matches` to search by something else. */
type Criterion = { kind: 'move'; move: MoveRef };

const plain = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").trim().toLowerCase();

const matches = (p: RosterView, c: Criterion) => p.moves.some((m) => m.move?.id === c.move.id);

/** Search the roster by any of its features, starting with moves. Every criterion must match. */
export function SearchBoard({
  gameId,
  roster,
  lang,
  accent,
}: {
  gameId: string;
  roster: RosterView[];
  lang: Lang;
  accent: string;
}) {
  const { t } = useT();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const name = (x: { nameEn: string; nameEs: string }) => (lang === 'en' ? x.nameEn : x.nameEs);
  const other = (x: { nameEn: string; nameEs: string }) => (lang === 'en' ? x.nameEs : x.nameEn);

  // Only moves some Pokémon of the roster has are worth suggesting, with how many have each.
  const known = useMemo(() => {
    const byId = new Map<number, { move: MoveRef; count: number }>();
    for (const p of roster) {
      for (const m of p.moves) {
        if (!m.move) continue;
        const row = byId.get(m.move.id) ?? { move: m.move, count: 0 };
        row.count++;
        byId.set(m.move.id, row);
      }
    }
    return [...byId.values()].sort((a, b) => b.count - a.count || a.move.nameEn.localeCompare(b.move.nameEn));
  }, [roster]);

  const results = useMemo(
    () => (criteria.length ? roster.filter((p) => criteria.every((c) => matches(p, c))) : []),
    [roster, criteria]
  );

  const addMove = (move: MoveRef) => {
    setError(null);
    setCriteria((prev) => (prev.some((c) => c.kind === 'move' && c.move.id === move.id) ? prev : [...prev, { kind: 'move', move }]));
  };

  function commit(text: string) {
    const q = plain(text);
    if (!q) return;
    const hit = known.find((k) => plain(k.move.nameEn) === q || plain(k.move.nameEs) === q);
    if (!hit) {
      setError(t('No Pokémon in your roster has the move "{name}". Pick one from the suggestions.', { name: text.trim() }));
      return;
    }
    addMove(hit.move);
  }

  const common = known.slice(0, 12);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">{t('Move')}</h2>
          <ComboInput
            list="search-moves"
            value=""
            placeholder={t('Type a move name…')}
            aria-label={t('Move')}
            onCommit={commit}
            className="w-full rounded-md border border-line bg-bg px-3 py-1.5 text-sm placeholder:text-muted"
          />
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {error}
            </p>
          )}
          {common.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">{t('Most common in your roster')}</p>
              <ul className="flex flex-wrap gap-1.5">
                {common.map(({ move, count }) => (
                  <li key={move.id}>
                    <button
                      type="button"
                      onClick={() => addMove(move)}
                      className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-muted"
                    >
                      {name(move)} <span className="text-muted">{count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {criteria.length > 0 && (
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t('Searching for')}</h2>
              <button type="button" onClick={() => setCriteria([])} className="text-xs text-muted underline">
                {t('Clear all')}
              </button>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {criteria.map((c) => (
                <li key={c.move.id}>
                  <button
                    type="button"
                    onClick={() => setCriteria((prev) => prev.filter((x) => x !== c))}
                    title={t('Remove')}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs"
                  >
                    <TypeBadge type={c.move.type} lang={lang} />
                    {name(c.move)}
                    <span aria-hidden className="text-muted">
                      ✕
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {criteria.length > 1 && (
              <p className="mt-2 text-[11px] text-muted">{t('Only Pokémon that have all of them are listed.')}</p>
            )}
          </section>
        )}
      </aside>

      <section>
        {criteria.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            {t('Choose a move to see which Pokémon of your roster have it.')}
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">{t('{n} Pokémon', { n: results.length })}</p>
            {results.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
                {t('No Pokémon in your roster has all of those moves.')}
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/${gameId}/roster?p=${p.id}`}
                      className="flex h-full gap-3 rounded-xl border border-line bg-surface p-3 hover:border-muted"
                      style={{ outlineColor: accent }}
                    >
                      <PokemonSprite p={p} size={64} animated={false} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.nickname ?? name(p.species)}</p>
                        <p className="truncate text-xs text-muted">
                          {p.nickname ? `${name(p.species)} · ` : ''}
                          {t('Lv. {level}', { level: p.level })}
                        </p>
                        <ul className="mt-1.5 flex flex-wrap gap-1">
                          {p.moves.map((m) => {
                            if (!m.move && !m.rawName) return null;
                            const hit = m.move != null && criteria.some((c) => c.move.id === m.move!.id);
                            return (
                              <li
                                key={m.slot}
                                className={`rounded border px-1.5 py-0.5 text-[11px] ${
                                  hit ? 'border-done/50 bg-done/10 text-done' : 'border-line text-muted'
                                }`}
                                title={m.move ? other(m.move) : undefined}
                              >
                                {m.move ? name(m.move) : m.rawName}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <datalist id="search-moves">
        {known.map(({ move }) => (
          <option key={move.id} value={name(move)} label={other(move)} />
        ))}
      </datalist>
    </div>
  );
}
