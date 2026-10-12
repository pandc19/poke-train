import { z } from 'zod';

/** Shapes every AI provider must return. Kept small: each field is shown in the UI. */

export const BuildAuditSchema = z.object({
  rating: z.enum(['strong', 'ok', 'weak']).describe('How good this Pokémon is as it stands right now'),
  summary: z.string().describe('Two or three sentences on the role it plays and how well it does it as it is'),
  issues: z.array(z.string()).describe('Short list of concrete problems: wasted EVs, a dead move slot, a mismatched item'),
  changes: z
    .array(z.object({ change: z.string(), effort: z.enum(['easy', 'medium', 'hard']), reason: z.string() }))
    .describe('At most three changes that would most improve it as it is, easiest and most valuable first'),
  evPlan: z
    .object({
      spread: z.string().describe('The EV spread to finish with, e.g. "252 Atk / 252 Spe / 4 HP"'),
      toTrain: z.string().describe('Exactly what is still missing from its current EVs, or "nothing" if it is done'),
      steps: z.array(z.string()).describe('Practical ways to get those EVs in this game'),
      items: z
        .array(z.object({ item: z.string(), stat: z.string(), why: z.string() }))
        .optional()
        .describe('Vitamins and similar items that would provide the EVs still to train'),
    })
    .describe('How to finish its EV training'),
  heldItem: z
    .object({ item: z.string(), reason: z.string() })
    .describe('The best held item for it as it is now. If it already holds the best one, name it'),
  recommendedMoves: z
    .array(z.object({ move: z.string(), reason: z.string() }))
    .describe('The best set of up to four moves for it, chosen only from the moves it can learn in this game'),
  howToGet: z
    .array(z.object({ what: z.string(), where: z.string() }))
    .describe('Where to obtain pending items, TMs (and their materials) or moves in this game'),
});
export type BuildAudit = z.infer<typeof BuildAuditSchema>;

const EvCount = z.number().int();

/**
 * What the model returns for an EV plan: the spread as numbers per stat, so
 * nothing can be mistaken for a stat value. The text shown is built from it.
 */
export const BuildAuditRawSchema = BuildAuditSchema.omit({ evPlan: true }).extend({
  evPlan: z
    .object({
      spread: z
        .object({
          hp: EvCount,
          attack: EvCount,
          defense: EvCount,
          specialAttack: EvCount,
          specialDefense: EvCount,
          speed: EvCount,
        })
        .describe('EVs (not stats) it should have when finished: the EVs per stat, at most 252 each and 510 in total'),
      steps: z.array(z.string()).describe('Practical ways to get the EVs still missing in this game'),
      items: z
        .array(z.object({ item: z.string(), stat: z.string(), why: z.string() }))
        .describe('Vitamins or similar items that provide the missing EVs, with the stat each one is for. Empty if none are missing'),
    })
    .describe('How to finish its EV training'),
});
export type BuildAuditRaw = z.infer<typeof BuildAuditRawSchema>;

/** The same answer for a game without EV training: there is no EV plan to give. */
export const BuildAuditNoEvSchema = BuildAuditSchema.omit({ evPlan: true });

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
