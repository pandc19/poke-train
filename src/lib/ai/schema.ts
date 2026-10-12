import { z } from 'zod';

/** Shapes every AI provider must return. Kept small: each field is shown in the UI. */

/**
 * What an audit of one Pokémon gives: how to finish its EV training, the best
 * held item, and the best moves. Nothing else.
 */
export const BuildAuditSchema = z.object({
  evPlan: z
    .object({
      spread: z.string().describe('The EV spread to finish with, e.g. "252 Atk / 252 Spe / 4 HP"'),
      toTrain: z.string().describe('Exactly what is still missing from its current EVs'),
      steps: z.array(z.string()).describe('Where and against which Pokémon to train each missing stat'),
      items: z
        .array(z.object({ item: z.string(), stat: z.string(), why: z.string() }))
        .optional()
        .describe('Vitamins and Power items for the missing EVs'),
    })
    .describe('How to finish its EV training'),
  heldItem: z
    .object({ item: z.string(), reason: z.string() })
    .describe('The best held item for it as it is now. If it already holds the best one, name it'),
  recommendedMoves: z
    .array(z.object({ move: z.string(), reason: z.string() }))
    .describe('The best set of up to four moves for it, chosen only from the moves it can learn in this game'),
});
export type BuildAudit = z.infer<typeof BuildAuditSchema>;

/** The same answer for a game without EV training: there is no EV plan to give. */
export const BuildAuditNoEvSchema = BuildAuditSchema.omit({ evPlan: true });

/**
 * What the model returns for the EV plan: the spread as numbers per stat, so
 * nothing can be mistaken for a stat value, and where to battle for each stat.
 * The text shown, and the vitamin counts, are built from it in code.
 */
export const BuildAuditRawSchema = BuildAuditSchema.omit({ evPlan: true }).extend({
  evPlan: z
    .object({
      spread: z
        .object({
          hp: z.number().int(),
          attack: z.number().int(),
          defense: z.number().int(),
          specialAttack: z.number().int(),
          specialDefense: z.number().int(),
          speed: z.number().int(),
        })
        .describe('EVs (not stats) it should have when finished: the EVs per stat, at most 252 each and 510 in total'),
      training: z
        .array(z.object({ stat: z.string(), battle: z.string() }))
        .describe(
          'One entry for each stat that still needs EVs: which wild Pokémon give that stat\'s EVs and where in this game to find them (area names). Empty if nothing is missing'
        ),
    })
    .describe('How to finish its EV training'),
});
export type BuildAuditRaw = z.infer<typeof BuildAuditRawSchema>;

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
