import { z } from 'zod';
import { FIELDS, type MappedRow } from '@/lib/import/fields';
import { loadDictionaries } from '@/lib/import/dictionaries';
import { interpretRow } from '@/lib/import/interpret';

const fieldKeys = FIELDS.map((f) => f.key) as [string, ...string[]];
const RowsSchema = z.array(z.partialRecord(z.enum(fieldKeys), z.string().max(2000))).min(1).max(2000);

const Body = z.object({ rows: RowsSchema });

/** Resolves mapped rows against the reference data without writing anything. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const dict = await loadDictionaries();
  const rows = parsed.data.rows.map((row, i) => interpretRow(row as MappedRow, i, dict));
  return Response.json({ rows });
}
