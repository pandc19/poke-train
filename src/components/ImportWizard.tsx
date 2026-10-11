'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FIELDS, applyMapping, guessMapping, type ColumnMapping, type FieldKey } from '@/lib/import/fields';
import type { ResolvedRow } from '@/lib/import/interpret';
import type { Lang } from '@/lib/i18n';

type Sheet = { name: string; rows: string[][] };
type Step = 'upload' | 'map' | 'preview' | 'done';

async function readFile(file: File): Promise<Sheet[]> {
  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    const Papa = (await import('papaparse')).default;
    const result = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' });
    return [{ name: file.name, rows: result.data }];
  }
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer());
  return workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils
      .sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false })
      .map((row) => row.map((cell) => String(cell ?? ''))),
  }));
}

const statusClass = (status: 'PENDING' | 'DONE') =>
  status === 'DONE' ? 'border-done/40 bg-done/10 text-done' : 'border-pending/40 bg-pending/10 text-pending';

export function ImportWizard({ gameId, gameName, lang }: { gameId: string; gameName: string; lang: Lang }) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<ResolvedRow[]>([]);
  const [markCaught, setMarkCaught] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const rows = useMemo(() => sheets[sheetIndex]?.rows ?? [], [sheets, sheetIndex]);
  const width = Math.max(0, ...rows.slice(0, 50).map((r) => r.length));
  const headers = useMemo(
    () => Array.from({ length: width }, (_, i) => (hasHeader ? rows[0]?.[i]?.trim() : '') || `Column ${i + 1}`),
    [rows, width, hasHeader]
  );
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const mappedFields = new Set(Object.values(mapping));
  const canPreview = mappedFields.has('species') || mappedFields.has('baseSpecies') || mappedFields.has('nationalDex');

  const name = (m: { nameEn: string; nameEs: string } | null) => (m ? (lang === 'en' ? m.nameEn : m.nameEs) : '—');

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = (await readFile(file)).filter((s) => s.rows.length > 0);
      if (!parsed.length) throw new Error('empty');
      setFileName(file.name);
      setSheets(parsed);
      setSheetIndex(0);
      setHasHeader(true);
      setMapping(guessMapping(parsed[0].rows[0] ?? []));
      setStep('map');
    } catch {
      setError('That file could not be read. Use a .csv or .xlsx file with one Pokémon per row.');
    } finally {
      setBusy(false);
    }
  }

  function setField(column: number, field: FieldKey | '') {
    setMapping((prev) => {
      const next: ColumnMapping = {};
      // A field can belong to one column only: taking it here releases it elsewhere.
      for (const [k, v] of Object.entries(prev)) {
        if (Number(k) !== column && v !== field) next[Number(k)] = v;
      }
      if (field) next[column] = field;
      return next;
    });
  }

  const mappedRows = () => dataRows.map((r) => applyMapping(r, mapping)).filter((r) => Object.keys(r).length > 0);

  async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? String(res.status));
    return res.json();
  }

  async function runPreview() {
    setBusy(true);
    setError(null);
    try {
      const data = await post<{ rows: ResolvedRow[] }>('/api/import/preview', { rows: mappedRows() });
      setPreview(data.rows);
      setStep('preview');
    } catch {
      setError('The preview failed. Check the column mapping and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const data = await post<{ imported: number; skipped: number }>('/api/import/commit', {
        gameId,
        fileName,
        mapping,
        rows: mappedRows(),
        markCaught,
      });
      setResult(data);
      setStep('done');
    } catch {
      setError('The import failed and nothing was saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const importable = preview.filter((r) => r.importable);
  const withIssues = importable.filter((r) => r.issues.length > 0);

  return (
    <div>
      <ol className="mb-6 flex gap-2 text-xs">
        {(['upload', 'map', 'preview', 'done'] as const).map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 capitalize ${
              s === step ? 'bg-ink font-semibold text-bg' : 'bg-surface-2 text-muted'
            }`}
          >
            {i + 1}. {s === 'map' ? 'Map columns' : s}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {step === 'upload' && (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void onFile(e.dataTransfer.files[0]);
              }}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface px-6 py-16 text-center hover:border-muted"
            >
              <span className="text-lg font-semibold">{busy ? 'Reading…' : 'Drop a spreadsheet here'}</span>
              <span className="text-sm text-muted">
                .csv or .xlsx, one Pokémon per row. Names can be in English or Spanish.
              </span>
              <span className="mt-2 rounded-md bg-surface-2 px-4 py-2 text-sm">Choose file</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls,.ods"
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
          )}

          {step === 'map' && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
                <span className="font-semibold">{fileName}</span>
                {sheets.length > 1 && (
                  <label className="flex items-center gap-2 text-muted">
                    Sheet
                    <select
                      value={sheetIndex}
                      onChange={(e) => {
                        const i = Number(e.target.value);
                        setSheetIndex(i);
                        setMapping(guessMapping(sheets[i].rows[0] ?? []));
                      }}
                      className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
                    >
                      {sheets.map((s, i) => (
                        <option key={s.name} value={i}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 text-muted">
                  <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                  First row is a header
                </label>
                <span className="text-muted">{dataRows.length} rows</span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Column in your file</th>
                      <th className="px-3 py-2">Sample values</th>
                      <th className="px-3 py-2">Import as</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-3 py-2 font-medium">{header}</td>
                        <td className="max-w-md px-3 py-2 text-xs text-muted">
                          {dataRows
                            .map((r) => r[i]?.trim())
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((v, k) => (
                              <div key={k} className="truncate">
                                {v}
                              </div>
                            ))}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={mapping[i] ?? ''}
                            onChange={(e) => setField(i, e.target.value as FieldKey | '')}
                            aria-label={`Import "${header}" as`}
                            className={`w-full rounded-md border bg-surface px-2 py-1 ${
                              mapping[i] ? 'border-done/50 text-ink' : 'border-line text-muted'
                            }`}
                          >
                            <option value="">Ignore this column</option>
                            {FIELDS.map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button onClick={() => setStep('upload')} className="rounded-md border border-line px-4 py-2 text-sm">
                  Back
                </button>
                <button
                  onClick={runPreview}
                  disabled={!canPreview || busy}
                  className="rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
                >
                  {busy ? 'Checking…' : 'Preview import'}
                </button>
                {!canPreview && <span className="text-sm text-muted">Map a Pokémon column to continue.</span>}
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p className="mb-4 text-sm">
                <span className="font-semibold">{importable.length}</span> Pokémon ready to import
                {withIssues.length > 0 && (
                  <>
                    , <span className="text-pending">{withIssues.length} with notes to review</span>
                  </>
                )}
                {preview.length > importable.length && (
                  <>
                    , <span className="text-pending">{preview.length - importable.length} will be skipped</span>
                  </>
                )}
                .
              </p>

              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Pokémon</th>
                      <th className="px-3 py-2">Nature</th>
                      <th className="px-3 py-2">Ability</th>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Moves</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => (
                      <tr key={r.index} className={`border-t border-line align-top ${r.importable ? '' : 'opacity-50'}`}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{name(r.species)}</div>
                          {r.baseSpecies && <div className="text-xs text-muted">from {name(r.baseSpecies)}</div>}
                          {!r.owned && r.importable && <div className="text-xs text-pending">not obtained yet</div>}
                        </td>
                        <td className="px-3 py-2">
                          {r.targetNature || r.currentNature ? (
                            <span className={`rounded border px-1.5 py-0.5 text-xs ${statusClass(r.natureStatus)}`}>
                              {name(r.currentNature ?? r.targetNature)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.ability ? (
                            <span className={`rounded border px-1.5 py-0.5 text-xs ${statusClass(r.abilityStatus)}`}>
                              {name(r.ability)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.item || r.itemNote ? (
                            <span className={`rounded border px-1.5 py-0.5 text-xs ${statusClass(r.itemStatus)}`}>
                              {r.item ? name(r.item) : r.itemNote}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex max-w-sm flex-wrap gap-1">
                            {r.moves.map((m) => (
                              <span
                                key={m.slot}
                                className={`rounded border px-1.5 py-0.5 text-xs ${statusClass(m.status)} ${
                                  m.match ? '' : 'italic underline decoration-dotted'
                                }`}
                              >
                                {m.match ? name(m.match) : m.raw}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-pending">
                          {r.issues.map((issue, k) => (
                            <div key={k}>{issue}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">
                <span className="text-done">Green</span> is already done, <span className="text-pending">orange</span>{' '}
                is still pending. Names that could not be matched are kept as typed (dotted underline) and can be
                fixed in the roster afterwards.
              </p>

              <label className="mt-4 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={markCaught} onChange={(e) => setMarkCaught(e.target.checked)} />
                Also mark the Pokémon I already have as caught in the {gameName} Pokédex
              </label>

              <div className="mt-4 flex gap-3">
                <button onClick={() => setStep('map')} className="rounded-md border border-line px-4 py-2 text-sm">
                  Back
                </button>
                <button
                  onClick={runImport}
                  disabled={busy || importable.length === 0}
                  className="rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
                >
                  {busy ? 'Importing…' : `Import ${importable.length} Pokémon`}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="rounded-xl border border-done/40 bg-done/10 px-6 py-10 text-center">
              <p className="text-lg font-semibold text-done">Imported {result.imported} Pokémon</p>
              {result.skipped > 0 && <p className="mt-1 text-sm text-muted">{result.skipped} rows were skipped.</p>}
              <Link
                href={`/${gameId}/roster`}
                className="mt-5 inline-block rounded-md bg-done px-4 py-2 text-sm font-semibold text-bg"
              >
                Open the roster
              </Link>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
