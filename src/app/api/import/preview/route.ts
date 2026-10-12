import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { FIELDS, type MappedRow } from '@/lib/import/fields';
import { loadDictionaries } from '@/lib/import/dictionaries';
import { interpretRow } from '@/lib/import/interpret';

const fieldKeys = FIELDS.map((f) => f.key) as [string, ...string[]];
const RowsSchema = z.array(z.partialRecord(z.enum(fieldKeys), z.string().max(2000))).min(1).max(2000);

const Body = z.object({
  rows: RowsSchema,
  /** The sheet has a status column, so a blank status means "not obtained yet". */
  statusColumn: z.boolean().optional(),
});

/** Resolves mapped rows against the reference data without writing anything. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError('Invalid body', 400);
  const dict = await loadDictionaries();
  const rows = parsed.data.rows.map((row, i) => interpretRow(row as MappedRow, i, dict, { statusColumn: parsed.data.statusColumn }));
  return Response.json({ rows });
}
