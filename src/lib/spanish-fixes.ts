/**
 * Spanish names PokéAPI has differently from the games (slug → the name the game shows). Only the Spanish
 * name changes; English keeps PokéAPI's. Kept across syncs and database restores, because it is applied
 * when names are read as well as when they are synced.
 */
export const SPANISH_FIXES: Record<string, string> = {
  'flash-cannon': 'Foco Resplandor',
  truant: 'Pereza',
};
