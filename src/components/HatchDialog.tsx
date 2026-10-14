'use client';

import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { Sprite } from './Sprite';
import type { HatchHelper } from '@/lib/breeding/hatch';
import type { Lang } from '@/lib/i18n';
import { useT } from '@/lib/translate-client';

/** What to do to hatch eggs faster, and which Pokémon of the game help (and whether you have them). */
export function HatchDialog({
  open,
  onClose,
  gameId,
  lang,
  picnic,
}: {
  open: boolean;
  onClose: () => void;
  gameId: string;
  lang: Lang;
  /** The game makes eggs at a picnic (and has Egg Power sandwiches). */
  picnic: boolean;
}) {
  const { t } = useT();
  const [helpers, setHelpers] = useState<HatchHelper[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || helpers) return;
    const controller = new AbortController();
    fetch(`/api/breeding/hatch?gameId=${encodeURIComponent(gameId)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { helpers: HatchHelper[] }) => {
        setFailed(false);
        setHelpers(data.helpers);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, [open, helpers, gameId]);

  const name = (x: { nameEn: string; nameEs: string }) => (lang === 'en' ? x.nameEn : x.nameEs);
  const haveLabel = { roster: t('in your box'), caught: t('you caught it'), no: t('not caught yet') } as const;
  const haveTone = { roster: 'bg-done/15 text-done', caught: 'bg-star/15 text-star', no: 'bg-pending/15 text-pending' } as const;
  const best = helpers?.find((h) => h.have === 'roster') ?? helpers?.find((h) => h.have === 'caught');

  return (
    <Dialog open={open} onClose={onClose} title={t('Hatch eggs faster')} wide>
      <div className="space-y-5 text-sm">
        <section>
          <h3 className="font-semibold">{t('1. Keep a Pokémon with a warm ability in your party')}</h3>
          <p className="mt-1 text-xs text-muted">
            {t(
              'Flame Body, Magma Armor or Steam Engine in the party halves the steps an egg needs. Only one counts: more than one does not stack. It does not need to battle, only to be in the party.'
            )}
          </p>
          {failed ? (
            <p className="mt-2 text-xs text-pending">{t('Could not load the Pokémon list. Try again.')}</p>
          ) : !helpers ? (
            <p className="mt-2 text-xs text-muted">{t('Loading…')}</p>
          ) : (
            <>
              {best ? (
                <p className="mt-2 rounded-lg bg-done/10 p-2 text-xs text-done">
                  {t('You already have one: {name} ({ability}). Put it in your party.', {
                    name: name(best.species),
                    ability: name(best.ability),
                  })}
                </p>
              ) : (
                <p className="mt-2 rounded-lg bg-pending/10 p-2 text-xs text-pending">
                  {t('You have none of these yet. The easiest to find are at the top of the list.')}
                </p>
              )}
              <ul className="mt-2 grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {helpers.map((h) => (
                  <li
                    key={`${h.species.id}-${h.ability.id}`}
                    className="flex items-center gap-2 rounded-lg border border-line p-1.5 text-xs"
                  >
                    <Sprite src={h.spriteUrl} alt="" size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{name(h.species)}</span>
                      <span className="block truncate text-muted">
                        {name(h.ability)}
                        {h.isHidden ? ` (${t('hidden')})` : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${haveTone[h.have]}`}>
                      {haveLabel[h.have]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-muted">
                {t('If it is the hidden ability, the Pokémon needs the hidden ability, not the usual one.')}
              </p>
            </>
          )}
        </section>

        {picnic && (
          <section>
            <h3 className="font-semibold">{t('2. Eat an Egg Power sandwich at the picnic')}</h3>
            <p className="mt-1 text-xs text-muted">
              {t(
                'Any sandwich with a sweet ingredient gives Egg Power: eggs show up in the basket much sooner. Keep only the two parents in the party so no other pair makes unwanted eggs.'
              )}
            </p>
          </section>
        )}

        <section>
          <h3 className="font-semibold">{picnic ? t('3. Carry several eggs and keep moving') : t('2. Carry several eggs and keep moving')}</h3>
          <p className="mt-1 text-xs text-muted">
            {t(
              'The steps count for every egg in the party at once, so hatch them together. Walking, running or riding all count; battles and menus do not. Moving in circles on a mount is the quickest way.'
            )}
          </p>
        </section>
      </div>
    </Dialog>
  );
}
