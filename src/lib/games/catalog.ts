import type { Localized } from '../translate';

/** One thing in a catalog: its name, what it does, and its sprite (a PokéAPI item slug). */
export type CatalogEntry = {
  name: Localized;
  effect: Localized;
  sprite?: string;
  /** Shown when the item has no sprite. */
  icon?: string;
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
/** The six stats in the order the games list them, with the name in each language. */
const STATS = [
  { en: 'HP', es: 'PS' },
  { en: 'Attack', es: 'Ataque' },
  { en: 'Defense', es: 'Defensa' },
  { en: 'Sp. Atk', es: 'Ataque Especial' },
  { en: 'Sp. Def', es: 'Defensa Especial' },
  { en: 'Speed', es: 'Velocidad' },
] as const;

/** Six items, one per stat, in the order above: [English name, Spanish name, sprite slug]. */
type SixItems = readonly [string, string, string][];

const perStat = (items: SixItems, effect: (stat: (typeof STATS)[number]) => Localized): CatalogEntry[] =>
  items.map(([en, es, sprite], i) => ({ name: { en, es }, effect: effect(STATS[i]), sprite }));

export const SCARLET_VIOLET_CATALOG: CatalogSection[] = [
  {
    id: 'vitamins',
    title: { en: 'Vitamins', es: 'Vitaminas' },
    note: {
      en: 'Each vitamin adds 10 EVs to one stat, up to the limit allowed.',
      es: 'Cada vitamina añade 10 EVs a una estadística, hasta el límite permitido.',
    },
    entries: perStat(
      [
        ['HP Up', 'Más PS', 'hp-up'],
        ['Protein', 'Proteína', 'protein'],
        ['Iron', 'Hierro', 'iron'],
        ['Calcium', 'Calcio', 'calcium'],
        ['Zinc', 'Zinc', 'zinc'],
        ['Carbos', 'Carburante', 'carbos'],
      ],
      (st) => ({ en: `Raises ${st.en} · +10 EVs`, es: `Mejora ${st.es} · +10 EVs` })
    ),
  },
  {
    id: 'feathers',
    title: { en: 'Feathers', es: 'Plumas' },
    note: {
      en: 'Each feather adds 1 EV to its stat. Useful to fill in exact amounts.',
      es: 'Cada pluma añade 1 EV a la estadística correspondiente. Son útiles para completar cantidades exactas.',
    },
    entries: perStat(
      [
        ['Health Feather', 'Pluma de Salud', 'health-wing'],
        ['Muscle Feather', 'Pluma Músculo', 'muscle-wing'],
        ['Resist Feather', 'Pluma de Aguante', 'resist-wing'],
        ['Genius Feather', 'Pluma Intelecto', 'genius-wing'],
        ['Clever Feather', 'Pluma Mente', 'clever-wing'],
        ['Swift Feather', 'Pluma Ímpetu', 'swift-wing'],
      ],
      (st) => ({ en: `${st.en} · +1 EV`, es: `${st.es} · +1 EV` })
    ),
  },
  {
    id: 'ev-reducers',
    title: { en: 'Items that lower EVs', es: 'Objetos que reducen EVs' },
    note: {
      en: 'Each berry removes 10 EVs from one stat.',
      es: 'Cada baya reductora elimina 10 EVs de una estadística.',
    },
    entries: [
      ...perStat(
        [
          ['Pomeg Berry', 'Baya Grana', 'pomeg-berry'],
          ['Kelpsy Berry', 'Baya Algama', 'kelpsy-berry'],
          ['Qualot Berry', 'Baya Ispero', 'qualot-berry'],
          ['Hondew Berry', 'Baya Meluce', 'hondew-berry'],
          ['Grepa Berry', 'Baya Uvav', 'grepa-berry'],
          ['Tamato Berry', 'Baya Tamate', 'tamato-berry'],
        ],
        (st) => ({ en: `Lowers ${st.en} · −10 EVs`, es: `Reduce ${st.es} · −10 EVs` })
      ),
      {
        name: { en: 'Fresh-Start Mochi', es: 'Mochi Reinicio' },
        effect: {
          en: 'Removes all of a Pokémon’s EVs at once. Used up on use. DLC: The Teal Mask.',
          es: 'Elimina todos los EVs de un Pokémon de una sola vez. Se consume al usarlo. DLC: La Máscara Turquesa.',
        },
        icon: '🍡',
      },
    ],
  },
  {
    id: 'power-items',
    title: { en: 'Power items', es: 'Objetos recios' },
    note: {
      en: 'Held while battling: each Pokémon defeated in a normal battle gives 8 extra EVs in one stat, on top of the EVs the opponent gives.',
      es: 'Se llevan equipados al combatir: añaden 8 EVs adicionales de una estadística por cada Pokémon derrotado en un combate normal, además de los EVs que conceda el rival.',
    },
    entries: perStat(
      [
        ['Power Weight', 'Pesa Recia', 'power-weight'],
        ['Power Bracer', 'Brazal Recio', 'power-bracer'],
        ['Power Belt', 'Cinturón Recio', 'power-belt'],
        ['Power Lens', 'Lente Recia', 'power-lens'],
        ['Power Band', 'Banda Recia', 'power-band'],
        ['Power Anklet', 'Franja Recia', 'power-anklet'],
      ],
      (st) => ({ en: `${st.en} · +8 EVs`, es: `${st.es} · +8 EVs` })
    ),
  },
];

export const itemSpriteUrl = (slug: string) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
