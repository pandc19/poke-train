'use client';

import { useT } from '@/lib/translate-client';

/** A text box for searching, with an X to clear what was typed. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className = '',
  inputClassName = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  /** Sizing and spacing of the wrapper. */
  className?: string;
  inputClassName?: string;
}) {
  const { t } = useT();
  return (
    <div className={`relative ${className}`}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={`w-full rounded-md border border-line bg-surface py-1.5 pl-3 pr-8 text-sm placeholder:text-muted ${inputClassName}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('Clear search')}
          title={t('Clear search')}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted hover:text-ink"
        >
          ✕
        </button>
      )}
    </div>
  );
}
