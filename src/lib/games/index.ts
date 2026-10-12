import type { Localized } from '../translate';
import { scarletVioletExclusives, type VersionExclusives } from './exclusives';
import { VIOLET_UTILITY_ROLES } from './utility-roles';

export type { VersionExclusives } from './exclusives';

/**
 * Per-game configuration: the single extension point for adding a game.
 * A new game is a new entry here plus `npm run db:seed && npm run sync:pokeapi`.
 */
export type GameConfig = {
  id: string;
  name: string;
  shortName: string;
  generation: number;
  /** Primary PokéAPI version group. */
  versionGroup: string;
  /** Every version group whose learnsets count as legal (base game + DLC). */
  learnsetVersionGroups: string[];
  /** PokéAPI pokedex slugs, in display order. `note` says where the dex comes from. */
  pokedexes: { slug: string; name: string; note: Localized }[];
  features: {
    breeding: boolean;
    evs: boolean;
    heldItems: boolean;
    abilities: boolean;
    teraType: boolean;
    /** Egg moves can be copied at a picnic with a Mirror Herb (Scarlet/Violet). */
    mirrorHerb: boolean;
    /** Has a Judge ("Juez") that rates a Pokémon's potential. */
    judge: boolean;
  };
  /** Cartridge colours for the game selector. */
  theme: { from: string; to: string; accent: string };
  utilityRoles: UtilityRole[];
  /** For games sold as a pair: what only this version and only the other version have. */
  versionExclusives?: VersionExclusives;
};

/**
 * A job every team wants covered early. The Starter team page checks which
 * Pokémon in the game can do it from real learnset and ability data, so
 * nothing here is a hand-written claim about locations.
 * All values are PokéAPI slugs.
 */
export type UtilityRole = {
  id: string;
  title: Localized;
  why: Localized;
  needs: {
    /** The Pokémon must learn every one of these. */
    allMoves?: string[];
    /** ...and at least one of these. */
    anyMoves?: string[];
    /** Or, instead, have one of these abilities. */
    anyAbilities?: string[];
  };
  tips: Localized[];
};

export const GAMES: GameConfig[] = [
  {
    id: 'violet',
    name: 'Pokémon Violet',
    shortName: 'Violet',
    generation: 9,
    versionGroup: 'scarlet-violet',
    learnsetVersionGroups: ['scarlet-violet', 'the-teal-mask', 'the-indigo-disk'],
    pokedexes: [
      { slug: 'paldea', name: 'Paldea', note: { en: 'Base game', es: 'Juego base' } },
      { slug: 'kitakami', name: 'Kitakami', note: { en: 'DLC: The Teal Mask', es: 'DLC: La Máscara Turquesa' } },
      { slug: 'blueberry', name: 'Blueberry', note: { en: 'DLC: The Indigo Disk', es: 'DLC: El Disco Índigo' } },
    ],
    features: {
      breeding: true,
      evs: true,
      heldItems: true,
      abilities: true,
      teraType: true,
      mirrorHerb: true,
      judge: true,
    },
    theme: { from: '#7c3aed', to: '#4c1d95', accent: '#c4b5fd' },
    utilityRoles: VIOLET_UTILITY_ROLES,
    versionExclusives: scarletVioletExclusives('violet'),
  },
];

export const NATIONAL_DEX_SLUG = 'national';

export function getGame(id: string): GameConfig | undefined {
  return GAMES.find((g) => g.id === id);
}
