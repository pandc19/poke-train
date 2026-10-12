/** One Pokémon (or one specific form of it) that only a single version has. */
export type ExclusiveEntry = {
  /** National Dex number. */
  dex: number;
  /** Set when only this form is exclusive, e.g. "Alola" or "Paldea Aqua". */
  form?: string;
};

/** A set of exclusives from one place: the base game, an expansion, an event. */
export type ExclusiveGroup = {
  id: string;
  label: string;
  note?: string;
  /** Keyed by the version's id: each lists what only that version has. */
  scarlet: ExclusiveEntry[];
  violet: ExclusiveEntry[];
};
