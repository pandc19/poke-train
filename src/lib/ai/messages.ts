/**
 * Messages the player can see that come from the AI layer. They are English
 * text that doubles as the translation key, like everything else.
 */
export const NO_AI_MESSAGE =
  'AI is not configured. Add OPENAI_API_KEY (or ANTHROPIC_API_KEY with AI_PROVIDER="claude") to .env.local and restart.';

export const WORKSPACE_MESSAGE =
  'This Anthropic API key is not scoped to a workspace. Set ANTHROPIC_WORKSPACE_ID in .env.local ' +
  '(the same workspace id taxap uses) and restart the dev server.';
