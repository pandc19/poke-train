import { ClaudeProvider } from './providers/claude';
import { OpenAiProvider } from './providers/openai';
import type { AiProvider } from './types';

export { AiError } from './types';
export type { AiProvider } from './types';

export { NO_AI_MESSAGE } from './messages';

export function configuredProviderName(): 'openai' | 'claude' {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  if (provider !== 'openai' && provider !== 'claude') {
    throw new Error(`Unknown AI_PROVIDER "${provider}" -- expected "openai" or "claude"`);
  }
  return provider;
}

/**
 * The provider picked by `AI_PROVIDER`, or `null` when that provider has no
 * API key. `null` is "no-AI mode", not an error: the app works fully and the
 * AI buttons explain how to turn them on.
 */
export function getAiProvider(): AiProvider | null {
  if (configuredProviderName() === 'openai') {
    return process.env.OPENAI_API_KEY ? new OpenAiProvider() : null;
  }
  return process.env.ANTHROPIC_API_KEY ? new ClaudeProvider() : null;
}
