import { z } from 'zod';

/** Shapes every AI provider must return. Kept small: each field is shown in the UI. */

export const BuildAuditSchema = z.object({
  rating: z.enum(['strong', 'ok', 'weak']).describe('Overall competitive quality of the build as planned'),
  summary: z.string().describe('Two or three sentences on the role this build plays and how well it does it'),
  issues: z.array(z.string()).describe('Concrete problems: anti-synergies, wasted slots, mismatched nature/EVs'),
  upgrades: z
    .array(z.object({ change: z.string(), reason: z.string() }))
    .describe('Specific swaps that would improve the build, most valuable first'),
  recommendedMoves: z
    .array(z.object({ move: z.string(), reason: z.string() }))
    .describe('The best set of up to four moves for this Pokémon in this game, whether or not it has them yet'),
  howToGet: z
    .array(z.object({ what: z.string(), where: z.string() }))
    .describe('Where to obtain pending items, TMs (and their materials) or moves in this game'),
});
export type BuildAudit = z.infer<typeof BuildAuditSchema>;

export const TeamAuditSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()).describe('Shared type weaknesses, missing roles, speed control gaps'),
  suggestions: z.array(z.object({ change: z.string(), reason: z.string() })),
});
export type TeamAudit = z.infer<typeof TeamAuditSchema>;

export const LocationSchema = z.object({
  found: z.boolean(),
  locations: z.array(z.object({ place: z.string(), details: z.string() })),
  notes: z.string(),
});
export type LocationResult = z.infer<typeof LocationSchema>;

export const StarterAdviceSchema = z.object({
  summary: z.string(),
  picks: z.array(z.object({ pokemon: z.string(), role: z.string(), why: z.string(), whereToGet: z.string() })),
});
export type StarterAdvice = z.infer<typeof StarterAdviceSchema>;
