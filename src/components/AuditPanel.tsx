import type { BuildAudit } from '@/lib/ai/schema';

const RATING: Record<BuildAudit['rating'], { label: string; className: string }> = {
  strong: { label: 'Strong build', className: 'text-done' },
  ok: { label: 'Solid, with room to improve', className: 'text-star' },
  weak: { label: 'Needs work', className: 'text-pending' },
};

/** Shows a stored AI build audit. */
export function AuditPanel({
  audit,
  meta,
  onRefresh,
  busy,
}: {
  audit: BuildAudit;
  meta: string;
  onRefresh?: () => void;
  busy: boolean;
}) {
  const rating = RATING[audit.rating] ?? RATING.ok;
  return (
    <div className="mt-3 space-y-3 rounded-lg bg-surface-2 p-3 text-xs">
      <div>
        <p className={`font-semibold ${rating.className}`}>{rating.label}</p>
        <p className="mt-1">{audit.summary}</p>
      </div>
      {audit.issues.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold uppercase text-muted">Issues</h4>
          <ul className="list-disc space-y-1 pl-4">
            {audit.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {(audit.recommendedMoves ?? []).length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold uppercase text-muted">Recommended moves</h4>
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
          <h4 className="mb-1 font-semibold uppercase text-muted">Suggested upgrades</h4>
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
          <h4 className="mb-1 font-semibold uppercase text-muted">Where to get it</h4>
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
        <span>AI-generated ({meta}). Check locations in game before relying on them.</span>
        {onRefresh && (
          <button onClick={onRefresh} disabled={busy} className="underline disabled:opacity-40">
            {busy ? 'Refreshing…' : 'Re-run'}
          </button>
        )}
      </p>
    </div>
  );
}
