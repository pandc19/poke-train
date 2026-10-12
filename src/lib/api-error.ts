import { getT } from './i18n';
import type { Vars } from './translate';

/**
 * A JSON error response whose message is in the player's language. The
 * English message is also the translation key, as everywhere else.
 */
export async function apiError(message: string, status: number, vars?: Vars): Promise<Response> {
  const t = await getT();
  return Response.json({ error: t(message, vars) }, { status });
}
