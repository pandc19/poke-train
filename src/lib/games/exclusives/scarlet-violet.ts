import type { ExclusiveGroup } from './types';

/**
 * Pokémon that can only be caught in one of the two paired versions.
 * Source: Bulbapedia, "Pokémon Scarlet and Violet" > "Version-exclusive Pokémon",
 * retrieved 2026-10-11. PokéAPI has no encounter data for these games, so this
 * list is maintained by hand: refresh it from that page when an expansion or
 * update changes availability.
 *
 * `dex` is the National Dex number. `form` is set when only a specific form is
 * exclusive (the other version has the species, in its ordinary form).
 */
export const SV_EXCLUSIVE_SOURCE = {
  name: 'Bulbapedia: Pokémon Scarlet and Violet, Version-exclusive Pokémon',
  retrieved: '2026-10-11',
};

export const SV_EXCLUSIVE_GROUPS: ExclusiveGroup[] = [
  {
    id: 'base',
    label: 'Base game',
    scarlet: [{ dex: 128, form: 'Paldea Blaze' }, { dex: 246 }, { dex: 247 }, { dex: 248 }, { dex: 425 }, { dex: 426 }, { dex: 434 }, { dex: 435 }, { dex: 633 }, { dex: 634 }, { dex: 635 }, { dex: 690 }, { dex: 691 }, { dex: 765 }, { dex: 874 }, { dex: 984 }, { dex: 985 }, { dex: 986 }, { dex: 987 }, { dex: 988 }, { dex: 989 }, { dex: 1005 }, { dex: 1007 }],
    violet: [{ dex: 128, form: 'Paldea Aqua' }, { dex: 200 }, { dex: 316 }, { dex: 317 }, { dex: 371 }, { dex: 372 }, { dex: 373 }, { dex: 429 }, { dex: 692 }, { dex: 693 }, { dex: 766 }, { dex: 875 }, { dex: 885 }, { dex: 886 }, { dex: 887 }, { dex: 990 }, { dex: 991 }, { dex: 992 }, { dex: 993 }, { dex: 994 }, { dex: 995 }, { dex: 1006 }, { dex: 1008 }],
  },
  {
    id: 'event',
    label: 'Event Tera Raids',
    note: 'Limited-time events. Not always available.',
    scarlet: [{ dex: 483 }, { dex: 1009 }],
    violet: [{ dex: 484 }, { dex: 1010 }],
  },
  {
    id: 'teal-mask',
    label: 'The Teal Mask',
    note: 'Kitakami DLC',
    scarlet: [{ dex: 207 }, { dex: 472 }, { dex: 845 }],
    violet: [{ dex: 190 }, { dex: 424 }, { dex: 877 }],
  },
  {
    id: 'indigo-disk',
    label: 'The Indigo Disk',
    note: 'Blueberry DLC',
    scarlet: [{ dex: 37, form: 'Alola' }, { dex: 38, form: 'Alola' }, { dex: 243 }, { dex: 244 }, { dex: 245 }, { dex: 250 }, { dex: 381 }, { dex: 383 }, { dex: 408 }, { dex: 409 }, { dex: 643 }, { dex: 646, form: 'White' }, { dex: 791 }, { dex: 800, form: 'Dusk Mane' }, { dex: 896 }, { dex: 1020 }, { dex: 1021 }],
    violet: [{ dex: 27, form: 'Alola' }, { dex: 28, form: 'Alola' }, { dex: 249 }, { dex: 380 }, { dex: 382 }, { dex: 410 }, { dex: 411 }, { dex: 638 }, { dex: 639 }, { dex: 640 }, { dex: 644 }, { dex: 646, form: 'Black' }, { dex: 792 }, { dex: 800, form: 'Dawn Wings' }, { dex: 897 }, { dex: 1022 }, { dex: 1023 }],
  },
];
