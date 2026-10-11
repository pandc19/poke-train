import type { z } from 'zod';
import type { ModelTier } from './models';

export type { ModelTier } from './models';

export type GenerateRequest<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Identifier for the schema (OpenAI requires one). */
  schemaName: string;
  /** Let the model search the web. Only for questions game data cannot answer. */
  webSearch: boolean;
  /** bulk: the cheaper everyday model. deep: the stronger escalation model. */
  tier: ModelTier;
};

/**
 * The one contract both providers implement: a prompt in, schema-validated
 * JSON out. Everything Pokémon-specific lives in tasks.ts, so adding a
 * provider never touches prompts or callers.
 */
export interface AiProvider {
  readonly name: 'openai' | 'claude';
  /** The model that answers requests of this tier. */
  modelFor(tier: ModelTier): string;
  generate<T>(request: GenerateRequest<T>): Promise<T>;
}

/** A failure worth showing to the user as-is (refusal, empty answer, bad key). */
export class AiError extends Error {}
