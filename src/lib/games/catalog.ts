import type { Localized } from '../translate';

/** One thing in a catalog: its name, what it does, and its sprite (a PokéAPI item slug). */
export type CatalogEntry = {
  name: Localized;
  effect: Localized;
  sprite?: string;
};

export type CatalogSection = {
  id: string;
  title: Localized;
  note?: Localized;
  entries: CatalogEntry[];
};

/**
 * Quick reference for a game, shown from the header. A game lists its own
 * (`catalog` in its config); to add more, add a section or entries here and
 * the dialog lists whatever is there.
 */
export const SCARLET_VIOLET_CATALOG: CatalogSection[] = [
  {
    id: 'ev-berries',
    title: { en: 'EV-reducing berries', es: 'Bayas que reducen EVs' },
    note: {
      en: 'Eat one to lower the EVs of that stat and free room for others.',
      es: 'Dale una para bajar los EVs de esa estadística y dejar sitio a otros.',
    },
    entries: [
      { name: { en: 'Pomeg Berry', es: 'Baya Grana' }, effect: { en: 'Lowers HP', es: 'Reduce PS' }, sprite: 'pomeg-berry' },
      { name: { en: 'Kelpsy Berry', es: 'Baya Algama' }, effect: { en: 'Lowers Attack', es: 'Reduce Ataque' }, sprite: 'kelpsy-berry' },
      { name: { en: 'Qualot Berry', es: 'Baya Ispero' }, effect: { en: 'Lowers Defense', es: 'Reduce Defensa' }, sprite: 'qualot-berry' },
      { name: { en: 'Hondew Berry', es: 'Baya Meluce' }, effect: { en: 'Lowers Sp. Atk', es: 'Reduce Ataque Especial' }, sprite: 'hondew-berry' },
      { name: { en: 'Grepa Berry', es: 'Baya Uvav' }, effect: { en: 'Lowers Sp. Def', es: 'Reduce Defensa Especial' }, sprite: 'grepa-berry' },
      { name: { en: 'Tamato Berry', es: 'Baya Tamate' }, effect: { en: 'Lowers Speed', es: 'Reduce Velocidad' }, sprite: 'tamato-berry' },
    ],
  },
  {
    id: 'ev-reset',
    title: { en: 'Reset all EVs', es: 'Reiniciar todos los EVs' },
    entries: [
      {
        name: { en: 'Fresh-Start Mochi', es: 'Mochi Reinicio' },
        effect: {
          en: 'Resets all of a Pokémon’s EVs to zero at once. Used up on use. DLC: The Teal Mask.',
          es: 'Restablece a cero todos los EVs de un Pokémon de una sola vez. Se consume al usarlo. DLC: La Máscara Turquesa.',
        },
        sprite: 'fresh-start-mochi',
      },
    ],
  },
];

export const itemSpriteUrl = (slug: string) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
