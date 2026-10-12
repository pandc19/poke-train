'use client';

import type { BuildAudit } from '@/lib/ai/schema';
import { useT } from '@/lib/translate-client';

/** Shows a stored AI build audit. */
export function AuditPanel({
  audit,
  auditLang,
  meta,
  onRefresh,
  onDeep,
  onChangeLanguage,
  busy,
}: {
  audit: BuildAudit;
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
  const ratings: Record<BuildAudit['rating'], { label: string; className: string }> = {
    strong: { label: t('Strong build'), className: 'text-done' },
    ok: { label: t('Solid, with room to improve'), className: 'text-star' },
    weak: { label: t('Needs work'), className: 'text-pending' },
  };
  const rating = ratings[audit.rating] ?? ratings.ok;
  const languageName = (code: string) => (code === 'en' ? t('English') : t('Spanish'));
  // The saved answer is never translated: switching language keeps it until it is re-run.
  const otherLanguage = auditLang != null && auditLang !== lang;

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
      <div>
        <p className={`font-semibold ${rating.className}`}>{rating.label}</p>
        <p className="mt-1">{audit.summary}</p>
      </div>
      {audit.issues.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold uppercase text-muted">{t('Issues')}</h4>
          <ul className="list-disc space-y-1 pl-4">
            {audit.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {(audit.recommendedMoves ?? []).length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold uppercase text-muted">{t('Recommended moves')}</h4>
          <ul className="space-y-1">
            {audit.recommendedMoves.map((m, i) => (
              <li key={i}>
                <span className="font-medium">{m.move}</span>
                <span className="text-muted"> · {m.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {audit.upgrades.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold uppercase text-muted">{t('Suggested upgrades')}</h4>
          <ul className="space-y-1">
            {audit.upgrades.map((u, i) => (
              <li key={i}>
                <span className="font-medium">{u.change}</span>
                <span className="text-muted"> · {u.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {audit.howToGet.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold uppercase text-muted">{t('Where to get it')}</h4>
          <ul className="space-y-1">
            {audit.howToGet.map((h, i) => (
              <li key={i}>
                <span className="font-medium">{h.what}</span>
                <span className="text-muted"> · {h.where}</span>
              </li>
            ))}
          </ul>
        </div>
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
