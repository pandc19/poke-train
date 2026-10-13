'use client';

import { useState } from 'react';
import { Dialog } from './Dialog';
import { Sprite } from './Sprite';
import { type CatalogSection, itemSpriteUrl } from '@/lib/games/catalog';
import { useT } from '@/lib/translate-client';

/** A floating button, reachable from anywhere on the page, that opens the current game's quick-reference catalog (EV berries and the like). */
export function CatalogButton({ sections }: { sections: CatalogSection[] }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('Catalog')}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink shadow-lg hover:bg-surface-2"
      >
        <span aria-hidden>📖</span>
        {t('Catalog')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('Catalog')} wide>
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.id}>
              <h3 className="text-sm font-semibold">{section.title[lang]}</h3>
              {section.note && <p className="mb-2 text-xs text-muted">{section.note[lang]}</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {section.entries.map((e) => (
                  <div key={e.name.en} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center">
                      {e.sprite || !e.icon ? (
                        <Sprite src={e.sprite ? itemSpriteUrl(e.sprite) : null} alt="" size={32} />
                      ) : (
                        <span className="text-2xl leading-none">{e.icon}</span>
                      )}
                    </span>
                    <div className="min-w-0 text-xs">
                      <p className="font-medium">{e.name[lang]}</p>
                      <p className="text-muted">{e.effect[lang]}</p>
                      {e.where && <p className="mt-0.5 text-[11px] text-muted">{e.where[lang]}</p>}
                      {/* The name in the other language, to search for in the game or the shop. */}
                      {e.sprite && (
                        <p className="mt-0.5 text-[11px] text-muted">
                          {t('Search for')}: {e.name.es}
                          {e.name.es !== e.name.en ? ` / ${e.name.en}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Dialog>
    </>
  );
}
