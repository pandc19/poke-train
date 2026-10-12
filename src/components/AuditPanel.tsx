'use client';

import type { BuildAudit } from '@/lib/ai/schema';
import { useT } from '@/lib/translate-client';

/** A stored audit. Audits saved by earlier versions hold other sections, which are no longer shown. */
type StoredAudit = Partial<BuildAudit>;

/** Shows a stored AI audit of one Pokémon. */
export function AuditPanel({
  audit,
  auditLang,
  meta,
  onRefresh,
  onDeep,
  onChangeLanguage,
  busy,
}: {
  audit: StoredAudit;
  /** The language the saved answer is written in. */
  auditLang?: string;
  meta: string;
  onRefresh?: () => void;
  /** Re-run on the stronger escalation model. */
  onDeep?: () => void;
  /** Get the audit in the selected language: a saved copy if there is one, otherwise a new request. */
  onChangeLanguage?: () => void;
  busy: boolean;
}) {
  const { t, lang } = useT();
  const languageName = (code: string) => (code === 'en' ? t('English') : t('Spanish'));
  // The saved answer is never translated: switching language keeps it until it is re-run.
  const otherLanguage = auditLang != null && auditLang !== lang;
  const heading = 'mb-1 font-semibold uppercase text-muted';

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-surface-2 p-3 text-xs">
      {otherLanguage && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-star/40 bg-star/10 px-2 py-1.5 text-star">
          <span>
            {t('This audit was written in {from}. Re-run it to get it in {to}.', {
              from: languageName(auditLang),
              to: languageName(lang),
            })}
          </span>
          {onChangeLanguage && (
            <button
              onClick={onChangeLanguage}
              disabled={busy}
              className="rounded border border-star/50 px-2 py-0.5 font-medium disabled:opacity-40"
            >
              {busy ? t('Refreshing…') : t('Re-run in {language}', { language: languageName(lang) })}
            </button>
          )}
        </div>
      )}

      {audit.evPlan && (
        <div>
          <h4 className={heading}>{t('EV plan')}</h4>
          <dl className="space-y-1">
            <div>
              <dt className="inline text-muted">{t('Finish with')}: </dt>
              <dd className="inline font-medium">{audit.evPlan.spread}</dd>
            </div>
            <div>
              <dt className="inline text-muted">{t('Still to train')}: </dt>
              <dd className="inline">{audit.evPlan.toTrain === 'nothing' || audit.evPlan.toTrain === 'nada' ? t('Nothing') : audit.evPlan.toTrain}</dd>
            </div>
          </dl>
          {audit.evPlan.items && audit.evPlan.items.length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {audit.evPlan.items.map((it, i) => (
                <li key={i}>
                  <span className="font-medium">{it.item}</span>
                  <span className="text-muted"> · {it.stat}: {it.why}</span>
                </li>
              ))}
            </ul>
          )}
          {audit.evPlan.steps.length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {audit.evPlan.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {audit.heldItem && (
        <div>
          <h4 className={heading}>{t('Held item')}</h4>
          <p>
            <span className="font-medium">{audit.heldItem.item}</span>
            <span className="text-muted"> · {audit.heldItem.reason}</span>
          </p>
        </div>
      )}

      {(audit.recommendedMoves ?? []).length > 0 && (
        <div>
          <h4 className={heading}>{t('Recommended moves')}</h4>
          <ul className="space-y-1">
            {audit.recommendedMoves!.map((m, i) => (
              <li key={i}>
                <span className="font-medium">{m.move}</span>
                <span className="text-muted"> · {m.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!audit.evPlan && !audit.heldItem && !(audit.recommendedMoves ?? []).length && (
        <p className="text-muted">{t('This audit is in an older format. Re-run it to get the EV plan, held item and moves.')}</p>
      )}

      <p className="flex items-center justify-between text-[10px] text-muted">
        <span>
          {t('AI-generated ({meta}). Check locations in game before relying on them.', { meta })}
          {auditLang && ` · ${languageName(auditLang)}`}
        </span>
        <span className="flex gap-3">
          {onRefresh && (
            <button onClick={onRefresh} disabled={busy} className="underline disabled:opacity-40">
              {busy ? t('Refreshing…') : t('Re-run')}
            </button>
          )}
          {onDeep && (
            <button onClick={onDeep} disabled={busy} className="underline disabled:opacity-40">
              {t('Re-run with the stronger model')}
            </button>
          )}
        </span>
      </p>
    </div>
  );
}
