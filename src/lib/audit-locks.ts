import { z } from 'zod';

const Pick = z.object({ item: z.string().min(1).max(100), reason: z.string().max(1000) });
const MovePick = z.object({ move: z.string().min(1).max(100), reason: z.string().max(1000) });

/** The parts of an AI audit the player has fixed, so that running the audit again keeps them. */
export const AuditLocksSchema = z.object({
  heldItem: Pick.optional(),
  moves: z.array(MovePick).max(4).optional(),
});
export type AuditLocks = z.infer<typeof AuditLocksSchema>;

type Moves = { move: string; reason: string }[];

/**
 * The recommended moves with the fixed ones first and in the same order, then
 * the model's others to fill the four slots. A move is never listed twice.
 */
export function withFixedMoves(fixed: Moves | undefined, suggested: Moves): Moves {
  const out = [...(fixed ?? [])];
  const seen = new Set(out.map((m) => m.move.toLowerCase()));
  for (const m of suggested) {
    if (out.length >= 4) break;
    if (seen.has(m.move.toLowerCase())) continue;
    seen.add(m.move.toLowerCase());
    out.push(m);
  }
  return out;
}
