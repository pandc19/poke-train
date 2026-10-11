/**
 * Which model answers which kind of request, configured the same way as
 * taxap: a cheaper "bulk" model for everyday requests and a stronger
 * "escalation" model for the harder ones. The old single-model variables
 * (CLAUDE_MODEL, OPENAI_MODEL) still work as a fallback for both.
 */
export type ModelTier = 'bulk' | 'deep';

type Env = Record<string, string | undefined>;

export function claudeModels(env: Env = process.env): Record<ModelTier, string> {
  return {
    bulk: env.CLAUDE_BULK_MODEL || env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    deep: env.CLAUDE_ESCALATION_MODEL || env.CLAUDE_MODEL || 'claude-opus-5-5',
  };
}

export function openAiModels(env: Env = process.env): Record<ModelTier, string> {
  return {
    bulk: env.OPENAI_BULK_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini',
    deep: env.OPENAI_ESCALATION_MODEL || env.OPENAI_MODEL || 'gpt-4o',
  };
}

/** Models that support Claude's newer web search tool (with dynamic filtering). */
const DYNAMIC_SEARCH = /^claude-(opus-(5|4-6|4-7|4-8)|sonnet-(5|4-6)|fable|mythos)/;

/**
 * The web search tool a Claude model can use. Haiku and older models only
 * support the basic version, so picking by model keeps a cheap bulk model working.
 */
export function claudeWebSearchTool(model: string) {
  return DYNAMIC_SEARCH.test(model)
    ? ({ type: 'web_search_20260209', name: 'web_search', max_uses: 5 } as const)
    : ({ type: 'web_search_20250305', name: 'web_search', max_uses: 5 } as const);
}
