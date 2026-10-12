'use client';

import { useState } from 'react';
import { PokemonInfoDialog } from './PokemonInfoDialog';
import { Sprite } from './Sprite';
import type { Lang } from '@/lib/i18n';

export type ExclusiveTile = {
  dex: number;
  /** Set when only this form is exclusive; the tile still shows the species. */
  form: string | null;
  nameEn: string;
  nameEs: string;
  spriteUrl: string | null;
  caught: boolean;
  have: boolean;
};

export type ExclusiveGroupView = {
  id: string;
  label: string;
  note?: string;
  own: ExclusiveTile[];
  other: ExclusiveTile[];
};

const FORM_LABELS: Record<string, string> = {
  Alola: 'Alolan form',
  'Paldea Blaze': 'Paldean form, Blaze Breed',
  'Paldea Aqua': 'Paldean form, Aqua Breed',
  White: 'White Kyurem',
  Black: 'Black Kyurem',
  'Dusk Mane': 'Dusk Mane Necrozma',
  'Dawn Wings': 'Dawn Wings Necrozma',
};

/** A small Pokédex of the Pokémon only one version has, grouped by where they come from. */
export function ExclusivesBoard({
  gameId,
  ownName,
  otherName,
  howToGetOther,
  groups,
  lang,
}: {
  gameId: string;
  ownName: string;
  otherName: string;
  howToGetOther: string;
  groups: ExclusiveGroupView[];
  lang: Lang;
}) {
  const [open, setOpen] = useState<{ tile: ExclusiveTile; own: boolean } | null>(null);

  const ownAll = groups.flatMap((g) => g.own);
  const ownCaught = ownAll.filter((t) => t.caught).length;
  const otherAll = groups.flatMap((g) => g.other);
  const otherCaught = otherAll.filter((t) => t.caught).length;

  const tiles = (list: ExclusiveTile[], own: boolean) => (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
      {list.map((t) => {
        const name = lang === 'en' ? t.nameEn : t.nameEs;
        return (
          <li key={`${t.dex}-${t.form ?? ''}`}>
            <button
              type="button"
              onClick={() => setOpen({ tile: t, own })}
              title={`${name}: open details`}
              className={`flex w-full flex-col items-center rounded-lg border px-1 py-1.5 hover:border-muted ${
                t.caught ? 'border-done/50 bg-done/5' : 'border-line bg-surface'
              }`}
            >
              <Sprite src={t.spriteUrl} alt="" size={56} silhouette={!t.caught && own} />
              <span className="mt-0.5 w-full truncate text-center text-[11px]">{name}</span>
              {t.form && (
                <span className="w-full truncate text-center text-[9px] text-muted">{FORM_LABELS[t.form] ?? t.form}</span>
              )}
              <span
                className={`mt-0.5 text-[10px] font-semibold ${
                  t.caught ? (t.have ? 'text-done' : 'text-pending') : 'text-muted'
                }`}
              >
                {t.caught ? (t.have ? '✓ have' : 'caught') : own ? 'missing' : 'trade / raid'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Only in {ownName} (your version)</p>
          <p className="mt-1 text-lg font-semibold">
            <span className="text-done">{ownCaught}</span> / {ownAll.length} caught
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Only in {otherName} (not in your game)</p>
          <p className="mt-1 text-lg font-semibold">
            <span className="text-pending">{otherCaught}</span> / {otherAll.length} obtained
          </p>
          <p className="mt-1 text-xs text-muted">{howToGetOther}</p>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.id} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="font-semibold">{g.label}</h2>
            {g.note && <p className="text-xs text-muted">{g.note}</p>}
            <div className="mt-3 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-done">
                  Only in {ownName} · you can catch these
                </h3>
                {tiles(g.own, true)}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pending">
                  Only in {otherName} · not in your game
                </h3>
                {tiles(g.other, false)}
              </div>
            </div>
          </section>
        ))}
      </div>

      <PokemonInfoDialog
        speciesId={open?.tile.dex ?? null}
        gameId={gameId}
        lang={lang}
        status={open ? { caught: open.tile.caught, have: open.tile.have } : undefined}
        exclusive={open ? { versionName: open.own ? ownName : otherName, own: open.own } : null}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
