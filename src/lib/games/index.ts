import type { Localized } from '../translate';
import { type CatalogSection, SCARLET_VIOLET_BREEDING_CATALOG, SCARLET_VIOLET_CATALOG } from './catalog';
import { scarletVioletExclusives, type VersionExclusives } from './exclusives';

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
  pokedexes: {
    slug: string;
    name: Localized;
    note: Localized;
    /** Lists regional forms (Alolan, Galarian, Hisuian) as Pokémon of their own, tracked apart from the normal ones. */
    regionalForms?: boolean;
    /** The game's own Pokédex ends here; PokéAPI lists a few extra species after it. */
    lastEntry?: number;
  }[];
  /** The game has a National Dex. Scarlet/Violet do not: only their regional Pokédexes. */
  nationalDex: boolean;
  features: {
    breeding: boolean;
    /** EV training exists. When false the app hides EVs and the AI gives no EV advice. */
    evs: boolean;
    /**
     * EVs are easy to reset and retrain (as in Legends: Z-A), so a target spread is worth planning.
     * When false the player just records the current EVs and the AI works with them.
     */
    evTarget: boolean;
    heldItems: boolean;
    abilities: boolean;
    teraType: boolean;
    /** Egg moves can be copied at a picnic with a Mirror Herb (Scarlet/Violet). */
    mirrorHerb: boolean;
    /** Has a Judge ("Juez") that rates a Pokémon's potential. */
    judge: boolean;
  };
  /** Quick-reference sections for this game (berries, items...), shown from the header. */
  catalog: CatalogSection[];
  /** Cartridge colours for the game selector. */
  theme: { from: string; to: string; accent: string };
  /** For games sold as a pair: what only this version and only the other version have. */
  versionExclusives?: VersionExclusives;
  /**
   * How EV training works here, when it is unusual (a different system, or very hard).
   * Passed to the AI so it does not assume the usual rules.
   */
  evNote?: string;
  /**
   * How to describe where a Pokémon is found, when the map works in a particular
   * way (open world with fast travel, several maps...). Passed to the AI as guidance on the
   * format of the answer, not as facts about locations.
   */
  locationNote?: string;
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
      { slug: 'paldea', name: { en: 'Paldea', es: 'Paldea' }, note: { en: 'Base game', es: 'Juego base' } },
      { slug: 'kitakami', name: { en: 'Kitakami', es: 'Noroteo' }, note: { en: 'DLC: The Teal Mask', es: 'DLC: La Máscara Turquesa' } },
      {
        slug: 'blueberry',
        name: { en: 'Blueberry', es: 'Arándano' },
        note: { en: 'DLC: The Indigo Disk', es: 'DLC: El Disco Índigo' },
        regionalForms: true,
        lastEntry: 240,
      },
    ],
    nationalDex: false,
    features: {
      breeding: true,
      evs: true,
      evTarget: false,
      heldItems: true,
      abilities: true,
      teraType: true,
      mirrorHerb: true,
      judge: true,
    },
    theme: { from: '#7c3aed', to: '#4c1d95', accent: '#c4b5fd' },
    catalog: [...SCARLET_VIOLET_CATALOG, ...SCARLET_VIOLET_BREEDING_CATALOG],
    locationNote:
      'Paldea is one open map and you can fast travel almost anywhere, so for each place give the area and the nearest fast-travel point, town or landmark to travel to. ' +
      'Kitakami and Blueberry Academy are separate DLC maps: say which map it is, and the nearest region of that map.',
    versionExclusives: scarletVioletExclusives('violet'),
  },
];

export const NATIONAL_DEX_SLUG = 'national';

export function getGame(id: string): GameConfig | undefined {
  return GAMES.find((g) => g.id === id);
}
