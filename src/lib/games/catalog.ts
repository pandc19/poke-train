import type { Localized } from '../translate';
import { DESTINY_KNOT, EVERSTONE, MIRROR_HERB, POWER_ITEMS } from '../breeding/items';

/** One thing in a catalog: its name, what it does, and its sprite (a PokéAPI item slug). */
export type CatalogEntry = {
  name: Localized;
  effect: Localized;
  sprite?: string;
  /** The item's PokéAPI slug, to look its name up in the game data when it has no sprite of its own. */
  item?: string;
  /** Shown when the item has no sprite. */
  icon?: string;
  /** Where to find it, when that is worth saying. */
  where?: Localized;
};

export type CatalogSection = {
  id: string;
  /** Which pages show it: the training pages (default) or the breeding pages. */
  topic?: 'training' | 'breeding';
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

/** The Mint for each nature that raises and lowers a stat: [English nature, Spanish nature, raises, lowers]. */
const MINT_NATURES = [
  ['Lonely', 'Huraña', 0, 1],
  ['Adamant', 'Firme', 0, 3],
  ['Naughty', 'Pícara', 0, 4],
  ['Brave', 'Audaz', 0, 5],
  ['Bold', 'Osada', 1, 0],
  ['Impish', 'Agitada', 1, 3],
  ['Lax', 'Floja', 1, 4],
  ['Relaxed', 'Plácida', 1, 5],
  ['Modest', 'Modesta', 3, 0],
  ['Mild', 'Afable', 3, 1],
  ['Rash', 'Alocada', 3, 4],
  ['Quiet', 'Mansa', 3, 5],
  ['Calm', 'Serena', 4, 0],
  ['Gentle', 'Amable', 4, 1],
  ['Careful', 'Cauta', 4, 3],
  ['Sassy', 'Grosera', 4, 5],
  ['Timid', 'Miedosa', 5, 0],
  ['Hasty', 'Activa', 5, 1],
  ['Jolly', 'Alegre', 5, 3],
  ['Naive', 'Ingenua', 5, 4],
] as const;

const MINT_ENTRIES: CatalogEntry[] = [
  ...MINT_NATURES.map(([en, es, up, down]): CatalogEntry => ({
    name: { en: `${en} Mint`, es: `Menta ${es}` },
    item: `${en.toLowerCase()}-mint`,
    icon: '🌱',
    effect: {
      en: `Acts as ${en}: raises ${STATS[up].en}, lowers ${STATS[down].en}`,
      es: `Actúa como ${es}: sube ${STATS[up].es}, baja ${STATS[down].es}`,
    },
  })),
  {
    name: { en: 'Serious Mint', es: 'Menta Seria' },
    item: 'serious-mint',
    icon: '🌱',
    effect: {
      en: 'Acts as a neutral nature: no stat goes up or down. The way to undo another mint, or to use the neutral natures (Hardy, Docile, Bashful, Quirky).',
      es: 'Actúa como una naturaleza neutra: ninguna estadística sube ni baja. Sirve para deshacer otra menta o para usar las naturalezas neutras (Fuerte, Dócil, Tímida, Rara).',
    },
  },
];

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
      en: 'Each berry removes 10 EVs from one stat. The app works EVs out from the stats, which only show them in steps of about 4 or more, so the drop it reads can be 8 or 12 instead of 10.',
      es: 'Cada baya reductora elimina 10 EVs de una estadística. La app calcula los EVs a partir de las estadísticas, que solo los muestran en pasos de unos 4 o más, así que la bajada que lee puede ser de 8 o 12 en vez de 10.',
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
    id: 'mints',
    title: { en: 'Mints', es: 'Mentas' },
    note: {
      en: 'A Mint changes which stats the nature raises and lowers (the game and the stats chart show the Mint’s effect). The real nature stays: it is the one an Everstone passes on. Record it on the Pokémon in the “Mint given” field.',
      es: 'Una menta cambia qué estadísticas sube y baja la naturaleza (el juego y el gráfico de estadísticas muestran el efecto de la menta). La naturaleza real no cambia: es la que pasa una Piedra Eterna. Anótala en el campo «Menta dada» del Pokémon.',
    },
    entries: MINT_ENTRIES,
  },
];

const POWER_STATS = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const;

/**
 * What to bring to breed well, and what to search for in the shop or the bag.
 * Item names are the ones the game shows in each language.
 */
export const SCARLET_VIOLET_BREEDING_CATALOG: CatalogSection[] = [
  {
    id: 'breeding-core',
    topic: 'breeding',
    title: { en: 'Held by the parents', es: 'Para los padres' },
    note: {
      en: 'Give these to the parents (or the picnic party) before the egg is made. One of each is enough.',
      es: 'Equípalos a los padres (o al grupo del picnic) antes de que aparezca el huevo. Con uno de cada es suficiente.',
    },
    entries: [
      {
        name: DESTINY_KNOT.name,
        sprite: DESTINY_KNOT.slug,
        effect: {
          en: 'The egg inherits 5 IVs from the parents instead of 3. Either parent can hold it.',
          es: 'El huevo hereda 5 IVs de los padres en vez de 3. Puede llevarlo cualquiera de los dos.',
        },
        where: { en: 'Sold at Delibird Presents (Mesagoza); stock grows with your badges.', es: 'Se vende en Delibird Presents (Mesagoza); el stock crece con tus medallas.' },
      },
      {
        name: EVERSTONE.name,
        sprite: EVERSTONE.slug,
        effect: {
          en: 'The egg gets the nature of the parent holding it.',
          es: 'El huevo tendrá la naturaleza del padre que lo lleve.',
        },
        where: { en: 'Sold at Delibird Presents (Mesagoza).', es: 'Se vende en Delibird Presents (Mesagoza).' },
      },
      {
        name: MIRROR_HERB.name,
        // PokéAPI has no picture for this item.
        item: MIRROR_HERB.slug,
        icon: '🌿',
        effect: {
          en: 'Held with a free move slot, it copies egg moves from the other Pokémon at a picnic, no egg needed.',
          es: 'Con un hueco libre en los movimientos, copia movimientos huevo de otro Pokémon en un picnic, sin necesidad de huevo.',
        },
      },
    ],
  },
  {
    id: 'breeding-power',
    topic: 'breeding',
    title: { en: 'Power items (pass one IV)', es: 'Objetos recios (pasan un IV)' },
    note: {
      en: 'The parent holding one always passes that stat’s IV to the egg. Pair it with a parent whose IV in that stat is Best (31).',
      es: 'El padre que lo lleve siempre pasa el IV de esa estadística al huevo. Úsalo con un padre cuyo IV en esa estadística sea Inmejorable (31).',
    },
    entries: POWER_STATS.map((stat) => {
      const label = { hp: ['HP', 'PS'], attack: ['Attack', 'Ataque'], defense: ['Defense', 'Defensa'], specialAttack: ['Sp. Atk', 'Ataque Especial'], specialDefense: ['Sp. Def', 'Defensa Especial'], speed: ['Speed', 'Velocidad'] }[stat];
      return {
        name: POWER_ITEMS[stat].name,
        sprite: POWER_ITEMS[stat].slug,
        effect: { en: `Passes ${label[0]} IV`, es: `Pasa el IV de ${label[1]}` },
      };
    }),
  },
  {
    id: 'breeding-sandwiches',
    topic: 'breeding',
    title: { en: 'Egg Power sandwiches', es: 'Sándwiches con Poder Huevo' },
    note: {
      en: 'Eat one at the picnic and eggs show up in the basket faster. Keep only the two parents plus one more in the party so other Pokémon do not make unwanted eggs.',
      es: 'Come uno en el picnic y los huevos aparecen antes en la cesta. Lleva solo a los dos padres y un Pokémon más para que otros no hagan huevos no deseados.',
    },
    entries: [
      {
        name: { en: 'Egg Power Lv. 1 (Jam Sandwich)', es: 'Poder Huevo Nv. 1 (Sándwich de mermelada)' },
        icon: '🥪',
        effect: {
          en: 'Eggs about 5 times more likely, hatch time 80%.',
          es: 'Los huevos son unas 5 veces más probables; el tiempo de eclosión baja al 80%.',
        },
        where: {
          en: 'Strawberry + Jam. Also: Banana + Peanut Butter, or Cheese + Marmalade.',
          es: 'Fresa + Mermelada de fruta. También: Plátano + Mantequilla de cacahuete, o Queso + Mermelada de naranja.',
        },
      },
      {
        name: { en: 'Egg Power Lv. 2 (Great Peanut Butter Sandwich)', es: 'Poder Huevo Nv. 2 (Sándwich de mantequilla de cacahuete)' },
        icon: '🥪',
        effect: {
          en: 'Eggs about 7 times more likely, hatch time 66%. No Herba Mystica needed.',
          es: 'Los huevos son unas 7 veces más probables; el tiempo de eclosión baja al 66%. No necesita Hierba Mística.',
        },
        where: {
          en: 'Banana + Peanut Butter + Butter. Also: Cheese + Marmalade + Butter.',
          es: 'Plátano + Mantequilla de cacahuete + Mantequilla. También: Queso + Mermelada de naranja + Mantequilla.',
        },
      },
      {
        name: { en: 'Egg Power Lv. 3 (needs Herba Mystica)', es: 'Poder Huevo Nv. 3 (necesita Hierba Mística)' },
        icon: '🥪',
        effect: {
          en: 'Eggs about 10 times more likely, hatch time 50%. Only a small step up from Lv. 2 and much more expensive.',
          es: 'Los huevos son unas 10 veces más probables; el tiempo de eclosión baja al 50%. Mejora poco respecto al Nv. 2 y es mucho más caro.',
        },
        where: {
          en: 'Basil + 2 Sweet Herba Mystica. Also reported: Lettuce + Salty Herba Mystica + Sweet Herba Mystica.',
          es: 'Albahaca + 2 Hierbas Místicas dulces. También se reporta: Lechuga + Hierba Mística salada + Hierba Mística dulce.',
        },
      },
    ],
  },
];

export const itemSpriteUrl = (slug: string) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
