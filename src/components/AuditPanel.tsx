'use client';

import { useState } from 'react';
import { useCachedLocations } from './useCachedLocations';
import { AiBadge } from './AiBadge';
import { Dialog } from './Dialog';
import { Sprite } from './Sprite';
import { TypeBadge } from './TypeBadge';
import { activeMint, type AuditLocks } from '@/lib/audit-locks';
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
          <p className="mb-1">
            <AiBadge />
          </p>
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
        <p className="mb-3 text-xs text-muted">{t('Best to battle first, each evolution line in order.')}</p>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {(all.species ?? []).map((sp) => (
            <SourceRow key={sp.id} s={sp} gameId={gameId} aiEnabled={aiEnabled} known={known[sp.id]} card />
          ))}
        </div>
      </Dialog>
    </div>
  );
}

/** One part of the audit in its own box, with a button that fixes it (and takes the fix away). */
function Box({
  title,
  fixed,
  onToggle,
  fixTitle,
  ai = true,
  children,
}: {
  title: string;
  fixed: boolean;
  /** Written by the AI (until the player fixes it, which makes it theirs). */
  ai?: boolean;
  /** Without it the part cannot be fixed. */
  onToggle?: () => void;
  fixTitle?: string;
  children: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <section className={`rounded-lg border bg-surface p-3 ${fixed ? 'border-done/50' : 'border-line'}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="font-semibold uppercase text-muted">
          {fixed && <span className="mr-1 text-done">✓</span>}
          {title}
          {ai && !fixed && <AiBadge className="ml-2" />}
        </h4>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            title={fixed ? t('Fixed parts stay the same when you run the audit again.') : fixTitle ?? t('Fixed parts stay the same when you run the audit again.')}
            className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
              fixed ? 'border-done/50 text-done hover:bg-done/10' : 'border-line text-muted hover:text-ink'
            }`}
          >
            {fixed ? t('Unfix') : t('Fix')}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Shows a stored AI audit of one Pokémon. */
export function AuditPanel({
  gameId,
  aiEnabled,
  locks,
  onLocksChange,
  compare,
  currentTera,
  onMint,
  mintGiven,
  realNature,
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
  /** What it has now against what the audit suggests, one row per part. */
  compare?: { key: string; label: string; now: string; ai: string; same: boolean }[];
  /** The Tera type it has now, to show beside the suggestion. */
  currentTera?: string | null;
  /** The nature (English name) of the Mint it was given, if any: "keep" is not said of a Mint it does not have. */
  mintGiven?: string | null;
  /** Its own nature (English name), what counts when it has no Mint. */
  realNature?: string | null;
  /** Records the suggested Mint as given (true) or takes it back (false). */
  onMint?: (nature: string, given: boolean) => void;
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
    const empty = !next.heldItem && !(next.moves ?? []).length && !next.teraType && !next.mint;
    onLocksChange?.(empty ? null : next);
  };
  const itemFixed = Boolean(locks?.heldItem);
  const movesFixed = locks?.moves ?? [];
  const teraFixed = locks?.teraType;
  const hasMint = mintGiven != null;
  // A fixed Mint only counts while it still holds; an answer saved before that changed is not shown.
  const mintFixed = activeMint(locks, mintGiven, realNature);
  const sameNature = (a?: string | null, b?: string | null) => a != null && b != null && a.toLowerCase() === b.toLowerCase();
  const staleMint =
    !mintFixed && audit.mint != null && !hasMint && audit.mint.keep && !sameNature(audit.mint.nature, realNature);
  const mintShown = mintFixed ? { ...mintFixed, keep: true } : audit.mint && !staleMint ? audit.mint : undefined;
  const recommended = audit.recommendedMoves ?? [];
  const without = (key: keyof AuditLocks): AuditLocks => {
    const rest = { ...locks };
    delete rest[key];
    return rest;
  };
  // Each part is fixed on its own; a fixed part stays as it is when the audit runs again, and is not asked of the AI.
  const toggleItem = () =>
    setLocks(
      itemFixed || !audit.heldItem
        ? without('heldItem')
        : { ...locks, heldItem: { item: audit.heldItem.item, reason: audit.heldItem.reason } }
    );
  const toggleMoves = () =>
    setLocks(
      movesFixed.length > 0 || recommended.length === 0
        ? without('moves')
        : { ...locks, moves: recommended.slice(0, 4).map((m) => ({ move: m.move, reason: m.reason })) }
    );
  const toggleTera = () =>
    setLocks(
      teraFixed || !audit.teraType
        ? without('teraType')
        : { ...locks, teraType: { type: audit.teraType.type, reason: audit.teraType.reason } }
    );
  const toggleMint = () => {
    if (mintFixed || !mintShown) return setLocks(without('mint'));
    // A Mint that is to change is recorded as given when it is fixed (the same as marking it by hand).
    if (!mintShown.keep) onMint?.(mintShown.nature, true);
    setLocks({ ...locks, mint: { nature: mintShown.nature, reason: mintShown.reason } });
  };
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

      {compare && compare.length > 0 && (
        <section className="rounded-lg border border-line bg-surface p-3">
          <h4 className="mb-2 font-semibold uppercase text-muted">
            {t('Now vs AI')} <AiBadge className="ml-1" />
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {compare.map((r) => (
              <div key={r.key} className="contents">
                <dt className="text-muted">{r.label}</dt>
                <dd className={r.same ? 'text-done' : ''}>
                  {r.same ? (
                    <>✓ {r.now}</>
                  ) : (
                    <>
                      <span className="text-muted">{r.now}</span>
                      <span className="mx-1 text-pending">→</span>
                      <span className="font-medium">{r.ai}</span>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {audit.evPlan && (
        <Box
          title={t('EV plan')}
          fixed={Boolean(lockedPlan)}
          onToggle={
            lockedPlan
              ? onUnlockPlan
              : onLockPlan && audit.evPlan.spread !== 'nothing' && audit.evPlan.spread !== 'nada'
                ? () => onLockPlan(audit.evPlan!.spread)
                : undefined
          }
          fixTitle={t('Saves this spread as your plan. The checklist marks it done once the Pokémon reaches it.')}
        >
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
        </Box>
      )}

      {!audit.evPlan && !audit.heldItem && !(audit.recommendedMoves ?? []).length && !audit.teraType && (
        <p className="text-muted">{t('This audit is in an older format. Re-run it to get the EV plan, held item and moves.')}</p>
      )}

      {audit.heldItem && (
        <Box title={t('Held item')} fixed={itemFixed} onToggle={onLocksChange ? toggleItem : undefined}>
          <p>
            <span className="font-medium">{audit.heldItem.item}</span>
            <span className="text-muted"> · {audit.heldItem.reason}</span>
          </p>
        </Box>
      )}

      {recommended.length > 0 && (
        <Box title={t('Recommended moves')} fixed={movesFixed.length > 0} onToggle={onLocksChange ? toggleMoves : undefined}>
          <ul className="space-y-1">
            {recommended.map((m, i) => (
              <li key={i}>
                <span className="font-medium">{m.move}</span>
                <span className="text-muted"> · {m.reason}</span>
              </li>
            ))}
          </ul>
        </Box>
      )}

      {(audit.teraType || teraFixed) && (
        <Box title={t('Tera type')} fixed={Boolean(teraFixed)} onToggle={onLocksChange ? toggleTera : undefined}>
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
        </Box>
      )}

      {mintShown && (
        <Box title={t('Mint')} fixed={Boolean(mintFixed)} onToggle={onLocksChange ? toggleMint : undefined}>
          <p>
            <span className="font-medium">
              {mintShown.keep
                ? hasMint
                  ? t('Keep it: {nature}', { nature: mintShown.nature })
                  : t('No Mint needed: {nature} is already the best', { nature: mintShown.nature })
                : hasMint
                  ? t('Change to {nature}', { nature: mintShown.nature })
                  : t('Use a {nature} Mint', { nature: mintShown.nature })}
            </span>
            <span className="text-muted"> · {mintShown.reason}</span>
          </p>
        </Box>
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
