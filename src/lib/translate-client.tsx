'use client';

import { createContext, useContext, useMemo } from 'react';
import { makeT, type Lang, type TFunction } from './translate';

const LangContext = createContext<{ lang: Lang; t: TFunction }>({ lang: 'es', t: makeT('es') });

/** Makes the selected language available to every client component below it. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  return <LangContext value={value}>{children}</LangContext>;
}

/** Call it as: const { t, lang } = useT(); then t(the English text). */
export const useT = () => useContext(LangContext);
