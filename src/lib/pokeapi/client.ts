import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://pokeapi.co/api/v2';
/** Same folder and file naming as scripts/sync-pokeapi.ts, so what the sync downloaded is reused. */
// The folder is read at runtime and is not part of the app, so keep the bundler from tracing it.
const CACHE_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), '.cache', 'pokeapi');

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Reads one PokéAPI resource, from the local cache when present, otherwise
 * from the live API (and then cached). Resource looks like "pokemon-species/74".
 */
export async function getPokeApi(resource: string): Promise<any> {
  const file = path.join(/* turbopackIgnore: true */ CACHE_DIR, resource.replace(/[/?=&]/g, '_') + '.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // not cached yet
  }
  const res = await fetch(`${API}/${resource}`);
  if (!res.ok) throw new Error(`PokéAPI answered ${res.status} for ${resource}`);
  const text = await res.text();
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, text);
  } catch {
    // a read-only disk only costs a refetch next time
  }
  return JSON.parse(text);
}
