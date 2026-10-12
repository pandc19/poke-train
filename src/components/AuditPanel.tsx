'use client';

import { useState } from 'react';
import { useCachedLocations } from './useCachedLocations';
import { Dialog } from './Dialog';
import { Sprite } from './Sprite';
import { TypeBadge } from './TypeBadge';
import type { AuditLocks } from '@/lib/audit-locks';
import type { BuildAudit, LocationResult } from '@/lib/ai/schema';
import { useT } from '@/lib/translate-client';

/** A stored audit. Audits saved by earlier versions hold other sections, which are no longer shown. */
type StoredAudit = Partial<BuildAudit>;

type EvSource = NonNullable<NonNullable<BuildAudit['evPlan']['sources']>[number]['species']>[number] & {
  /** Sent when the full list is loaded; audits saved earlier do not have it. */
  spriteUrl?: string | null;
};

/** One Pokémon to battle for EVs, with a button that researches where it lives in this game. */
function SourceRow({
  s,
  gameId,
  aiEnabled,
  known,
  card = false,
}: {
  s: EvSource;
  gameId?: string;
  aiEnabled?: boolean;
  /** An answer saved earlier, so it survives a reload. */
  known?: LocationResult;
  /** A small card with the picture, instead of a bullet in a list. */
  card?: boolean;
}) {
  const { t, lang } = useT();
  const [state, setState] = useState<{ busy: boolean; result?: LocationResult; error?: string }>({ busy: false });
  // A saved answer starts collapsed; a lookup you just made opens.
  const [open, setOpen] = useState(false);
  const result = state.result ?? known;

  async function locate(refresh = false) {
    setState({ busy: true });
    try {
      const res = await fetch('/api/ai/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, speciesId: s.id, refresh }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t('Lookup failed.'));
      setState({ busy: false, result: data.result });
      setOpen(true);
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : t('Lookup failed.') });
    }
  }

  const body = (
    <>
      <span className="font-medium">{lang === 'es' ? s.nameEs : s.nameEn}</span>
      <span className="text-muted"> · +{s.amount}</span>
      {gameId && (
        <button
          onClick={result ? () => setOpen(!open) : () => locate()}
          disabled={!aiEnabled || state.busy}
          title={aiEnabled ? t('Researched on the web with AI') : t('Add an API key to .env.local to enable location lookups')}
          className="ml-2 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted hover:text-ink disabled:opacity-40"
        >
          {state.busy ? t('Searching…') : result ? (open ? t('Hide') : t('Show')) : t('Where do I find it?')}
        </button>
      )}
      {state.error && <p className="text-pending">{state.error}</p>}
      {result && open && (
        <div className="mt-1 rounded bg-surface p-2 text-muted">
          {result.locations.map((l, i) => (
            <p key={i}>
              <span className="font-medium text-ink">{l.place}</span>
              {l.nearby && ` · ${t('Near')}: ${l.nearby}`} · {l.details}
            </p>
          ))}
          {result.notes && <p className="mt-1">{result.notes}</p>}
          <button
            onClick={() => locate(true)}
            disabled={!aiEnabled || state.busy}
            className="mt-1 text-[10px] underline disabled:opacity-40"
          >
            {state.busy ? t('Searching…') : t('Search again')}
          </button>
        </div>
      )}
    </>
  );
  return card ? (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-2">
      <span className="grid h-10 w-10 shrink-0 place-items-center">
        <Sprite src={s.spriteUrl ?? null} alt="" size={40} />
      </span>
      <div className="min-w-0 flex-1">{body}</div>
    </div>
  ) : (
    <li>{body}</li>
  );
}

/** The Pokémon to battle for one stat: the best few, and a button for all of them. */
function SourceGroup({
  group,
  gameId,
  aiEnabled,
  saved,
}: {
  group: NonNullable<BuildAudit['evPlan']['sources']>[number];
  gameId?: string;
  aiEnabled?: boolean;
  saved: Record<number, LocationResult>;
}) {
  const { t } = useT();
  const [all, setAll] = useState<{ busy: boolean; open: boolean; species?: EvSource[]; error?: string }>({
    busy: false,
    open: false,
  });
  const extraSaved = useCachedLocations(gameId, (all.species ?? []).map((x) => x.id));
  const known = { ...saved, ...extraSaved };

  async function toggleAll() {
    if (all.species) return setAll({ ...all, open: true });
    setAll({ busy: true, open: false });
    try {
      const res = await fetch(`/api/ev-sources?gameId=${encodeURIComponent(gameId!)}&stat=${encodeURIComponent(group.stat)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t('Lookup failed.'));
      setAll({ busy: false, open: true, species: data.species });
    } catch (e) {
      setAll({ busy: false, open: false, error: e instanceof Error ? e.message : t('Lookup failed.') });
    }
  }

  return (
    <div className="mt-2">
      <p className="text-muted">
        {t('Battle for {stat} EVs', { stat: group.stat })}
        {gameId && (
          <button onClick={toggleAll} disabled={all.busy} className="ml-2 text-[10px] underline disabled:opacity-40">
            {all.busy ? t('Searching…') : t('Show all ({n})', { n: all.species?.length ?? '…' })}
          </button>
        )}
      </p>
      {all.error && <p className="text-pending">{all.error}</p>}
      <ul className="list-disc space-y-1 pl-4">
        {group.species.map((sp) => (
          <SourceRow key={sp.id} s={sp} gameId={gameId} aiEnabled={aiEnabled} known={known[sp.id]} />
        ))}
      </ul>
      <Dialog
        open={all.open}
        onClose={() => setAll((a) => ({ ...a, open: false }))}
        title={t('Battle for {stat} EVs', { stat: group.stat })}
        wide
      >
        <p className="mb-3 text-xs text-muted">{t('Best to battle first.')}</p>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {(all.species ?? []).map((sp) => (
            <SourceRow key={sp.id} s={sp} gameId={gameId} aiEnabled={aiEnabled} known={known[sp.id]} card />
          ))}
        </div>
      </Dialog>
    </div>
  );
}

/** Shows a stored AI audit of one Pokémon. */
export function AuditPanel({
  gameId,
  aiEnabled,
  locks,
  onLocksChange,
  currentTera,
  lockedPlan,
  onLockPlan,
  onUnlockPlan,
  audit,
  auditLang,
  meta,
  onRefresh,
  onDeep,
  onChangeLanguage,
  busy,
}: {
  /** Lets the Pokémon to battle be looked up. */
  gameId?: string;
  aiEnabled?: boolean;
  /** The held item and moves the player has fixed. */
  locks?: AuditLocks | null;
  onLocksChange?: (locks: AuditLocks | null) => void;
  /** The Tera type it has now, to show beside the suggestion. */
  currentTera?: string | null;
  /** The EV spread the player has fixed as the plan, if any. */
  lockedPlan?: string | null;
  onLockPlan?: (spread: string) => void;
  onUnlockPlan?: () => void;
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
  const saved = useCachedLocations(
    gameId,
    (audit.evPlan?.sources ?? []).flatMap((g) => g.species.map((x) => x.id))
  );
  const setLocks = (next: AuditLocks) => {
    const empty = !next.heldItem && !(next.moves ?? []).length && !next.teraType;
    onLocksChange?.(empty ? null : next);
  };
  const itemFixed = Boolean(locks?.heldItem);
  const movesFixed = locks?.moves ?? [];
  const teraFixed = locks?.teraType;
  const anyFixed = itemFixed || movesFixed.length > 0 || Boolean(teraFixed);
  const recommended = audit.recommendedMoves ?? [];
  // One button fixes the held item and all the moves together, or lets them all go.
  const toggleFixed = () => {
    if (anyFixed) return setLocks({});
    setLocks({
      heldItem: audit.heldItem ? { item: audit.heldItem.item, reason: audit.heldItem.reason } : undefined,
      moves: recommended.slice(0, 4).map((m) => ({ move: m.move, reason: m.reason })),
      teraType: audit.teraType ? { type: audit.teraType.type, reason: audit.teraType.reason } : undefined,
    });
  };
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
          {lockedPlan ? (
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded border border-done/50 px-2 py-0.5 text-[11px] font-medium text-done">
                ✓ {t('Plan fixed')}
              </span>
              {onUnlockPlan && (
                <button
                  onClick={onUnlockPlan}
                  title={t('Fixed parts stay the same when you run the audit again.')}
                  className="rounded border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink"
                >
                  {t('Unfix')}
                </button>
              )}
            </p>
          ) : (
            onLockPlan &&
            audit.evPlan.spread !== 'nothing' &&
            audit.evPlan.spread !== 'nada' && (
              <button
                onClick={() => onLockPlan(audit.evPlan!.spread)}
                title={t('Saves this spread as your plan. The checklist marks it done once the Pokémon reaches it.')}
                className="mt-1 rounded border border-done/50 px-2 py-0.5 text-[11px] font-medium text-done"
              >
                {t('Fix this plan')}
              </button>
            )
          )}
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
          {(audit.evPlan.sources ?? []).map((group) => (
            <SourceGroup key={group.stat} group={group} gameId={gameId} aiEnabled={aiEnabled} saved={saved} />
          ))}
          {(audit.evPlan.steps ?? []).length > 0 && !audit.evPlan.sources && (
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {audit.evPlan.steps!.map((s, i) => (
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

      {(audit.teraType || teraFixed) && (
        <div>
          <h4 className={heading}>{t('Tera type')}</h4>
          {(() => {
            // A type the player fixed is the one a re-run keeps, so it is the one shown.
            const shown = teraFixed ?? audit.teraType!;
            return (
              <p className="flex flex-wrap items-center gap-2">
                <TypeBadge type={shown.type} lang={lang} />
                {shown.reason && <span className="text-muted">· {shown.reason}</span>}
              </p>
            );
          })()}
          {currentTera && currentTera !== (teraFixed ?? audit.teraType)?.type && (
            <p className="mt-1 flex items-center gap-2 text-muted">
              {t('Current Tera type')}: <TypeBadge type={currentTera} lang={lang} />
            </p>
          )}
        </div>
      )}

      {!audit.evPlan && !audit.heldItem && !(audit.recommendedMoves ?? []).length && !audit.teraType && (
        <p className="text-muted">{t('This audit is in an older format. Re-run it to get the EV plan, held item and moves.')}</p>
      )}

      {onLocksChange && (audit.heldItem || recommended.length > 0 || audit.teraType) && (
        <p className="flex flex-wrap items-center gap-2">
          {anyFixed ? (
            <>
              <span className="rounded border border-done/50 px-2 py-0.5 text-[11px] font-medium text-done">
                ✓ {audit.teraType || teraFixed ? t('Item, moves and Tera type fixed') : t('Item and moves fixed')}
              </span>
              <button
                onClick={toggleFixed}
                title={t('Fixed parts stay the same when you run the audit again.')}
                className="rounded border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink"
              >
                {t('Unfix')}
              </button>
            </>
          ) : (
            <button
              onClick={toggleFixed}
              title={t('Fixed parts stay the same when you run the audit again.')}
              className="rounded border border-line px-2 py-0.5 text-[11px] font-medium text-muted hover:text-ink"
            >
              {audit.teraType ? t('Fix item, moves and Tera type') : t('Fix item and moves')}
            </button>
          )}
        </p>
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
