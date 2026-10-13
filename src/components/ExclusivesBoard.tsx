'use client';

import { useState } from 'react';
import { PokemonInfoDialog } from './PokemonInfoDialog';
import { ScrollTopButton } from './ScrollTopButton';
import { Sprite } from './Sprite';
import type { Lang, Localized } from '@/lib/i18n';
import { pick } from '@/lib/translate';
import { useT } from '@/lib/translate-client';

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
  label: Localized;
  note?: Localized;
  own: ExclusiveTile[];
  other: ExclusiveTile[];
};

const FORM_LABELS: Record<string, Localized> = {
  Alola: { en: 'Alolan form', es: 'Forma de Alola' },
  'Paldea Blaze': { en: 'Paldean form, Blaze Breed', es: 'Forma de Paldea, Raza Ígnea' },
  'Paldea Aqua': { en: 'Paldean form, Aqua Breed', es: 'Forma de Paldea, Raza Acuática' },
  White: { en: 'White Kyurem', es: 'Kyurem Blanco' },
  Black: { en: 'Black Kyurem', es: 'Kyurem Negro' },
  'Dusk Mane': { en: 'Dusk Mane Necrozma', es: 'Necrozma Melena Crepuscular' },
  'Dawn Wings': { en: 'Dawn Wings Necrozma', es: 'Necrozma Alas del Alba' },
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
  howToGetOther: Localized;
  groups: ExclusiveGroupView[];
  lang: Lang;
}) {
  const { t } = useT();
  const [open, setOpen] = useState<{ tile: ExclusiveTile; own: boolean } | null>(null);

  const ownAll = groups.flatMap((g) => g.own);
  const ownCaught = ownAll.filter((x) => x.caught).length;
  const otherAll = groups.flatMap((g) => g.other);
  const otherCaught = otherAll.filter((x) => x.caught).length;

  const tiles = (list: ExclusiveTile[], own: boolean) => (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
      {list.map((tile) => {
        const name = lang === 'en' ? tile.nameEn : tile.nameEs;
        return (
          <li key={`${tile.dex}-${tile.form ?? ''}`}>
            <button
              type="button"
              onClick={() => setOpen({ tile, own })}
              title={t('{name}: open details', { name })}
              className={`flex w-full flex-col items-center rounded-lg border px-1 py-1.5 hover:border-muted ${
                tile.caught ? 'border-done/50 bg-done/5' : 'border-line bg-surface'
              }`}
            >
              <Sprite src={tile.spriteUrl} alt="" size={56} silhouette={!tile.caught && own} />
              <span className="mt-0.5 w-full truncate text-center text-[11px]">{name}</span>
              {tile.form && (
                <span className="w-full truncate text-center text-[9px] text-muted">{FORM_LABELS[tile.form] ? pick(FORM_LABELS[tile.form], lang) : tile.form}</span>
              )}
              <span
                className={`mt-0.5 text-[10px] font-semibold ${
                  tile.caught ? (tile.have ? 'text-done' : 'text-pending') : 'text-muted'
                }`}
              >
                {tile.caught ? (tile.have ? `✓ ${t('have')}` : t('caught')) : own ? t('missing') : t('trade / raid')}
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
          <p className="text-xs uppercase tracking-wide text-muted">
            {t('Only in {name} (your version)', { name: ownName })}
          </p>
          <p className="mt-1 text-lg font-semibold">
            <span className="text-done">{ownCaught}</span> / {ownAll.length} {t('caught')}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-xs uppercase tracking-wide text-muted">
            {t('Only in {name} (not in your game)', { name: otherName })}
          </p>
          <p className="mt-1 text-lg font-semibold">
            <span className="text-pending">{otherCaught}</span> / {otherAll.length} {t('obtained')}
          </p>
          <p className="mt-1 text-xs text-muted">{pick(howToGetOther, lang)}</p>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.id} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="font-semibold">{pick(g.label, lang)}</h2>
            {g.note && <p className="text-xs text-muted">{pick(g.note, lang)}</p>}
            <div className="mt-3 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-done">
                  {t('Only in {name} · you can catch these', { name: ownName })}
                </h3>
                {tiles(g.own, true)}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pending">
                  {t('Only in {name} · not in your game', { name: otherName })}
                </h3>
                {tiles(g.other, false)}
              </div>
            </div>
          </section>
        ))}
      </div>

      <ScrollTopButton />

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
