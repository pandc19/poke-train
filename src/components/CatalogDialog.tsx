'use client';

import { useState } from 'react';
import { Dialog } from './Dialog';
import { Sprite } from './Sprite';
import { type CatalogSection, itemSpriteUrl } from '@/lib/games/catalog';
import { useT } from '@/lib/translate-client';

/** A header button that opens the current game's quick-reference catalog (EV berries and the like). */
export function CatalogButton({ sections }: { sections: CatalogSection[] }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
      >
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
                      <Sprite src={e.sprite ? itemSpriteUrl(e.sprite) : null} alt="" size={32} />
                    </span>
                    <div className="min-w-0 text-xs">
                      <p className="font-medium">{e.name[lang]}</p>
                      <p className="text-muted">{e.effect[lang]}</p>
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
