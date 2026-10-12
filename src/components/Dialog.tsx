'use client';

import { useEffect, useRef } from 'react';
import { useT } from '@/lib/translate-client';

/**
 * A modal built on the native <dialog>: focus is trapped, Escape closes it,
 * and clicking the backdrop closes it. Children are only mounted while open,
 * so forms start from fresh state every time.
 */
export function Dialog({
  open,
  onClose,
  title,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto max-h-[90vh] overflow-y-auto rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/60 ${
        wide ? 'w-[min(94vw,46rem)]' : 'w-[min(94vw,26rem)]'
      }`}
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label={t('Close')} className="text-muted hover:text-ink">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  disabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <div className="text-sm text-muted">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-line px-4 py-2 text-sm">
          {t('Cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
            danger ? 'bg-red-600 hover:bg-red-500' : 'bg-done !text-bg'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
