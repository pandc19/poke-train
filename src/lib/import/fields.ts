import { normalizeKey } from './text';

/** Everything a spreadsheet column can be mapped to. */
export const FIELDS = [
  { key: 'nationalDex', label: 'National Dex number', hint: 'Number of the species (base or final)' },
  { key: 'baseSpecies', label: 'Base Pokémon (bred / caught)', hint: 'e.g. Geodude' },
  { key: 'species', label: 'Final Pokémon', hint: 'e.g. Golem. Required unless a base Pokémon is mapped' },
  { key: 'nickname', label: 'Nickname', hint: '' },
  { key: 'gender', label: 'Gender', hint: '' },
  { key: 'targetNature', label: 'Recommended nature / mint', hint: '' },
  { key: 'currentNature', label: 'Current nature', hint: 'What the Pokémon has right now' },
  { key: 'targetMoves', label: 'Recommended moves (one cell)', hint: 'Comma-separated list' },
  { key: 'currentMoves', label: 'Current moves (one cell)', hint: 'Comma-separated list' },
  { key: 'move1', label: 'Move 1', hint: '' },
  { key: 'move2', label: 'Move 2', hint: '' },
  { key: 'move3', label: 'Move 3', hint: '' },
  { key: 'move4', label: 'Move 4', hint: '' },
  { key: 'ability', label: 'Ability', hint: '' },
  { key: 'item', label: 'Held item', hint: '' },
  { key: 'berry', label: 'Berry', hint: 'Used as the held item when no item is given' },
  { key: 'evs', label: 'EV spread', hint: 'e.g. 252 Atk / 4 SpD / 252 Spe' },
  { key: 'currentEvs', label: 'Current EV spread', hint: 'What the Pokémon has right now' },
  { key: 'teraType', label: 'Tera type', hint: '' },
  { key: 'origin', label: 'Origin (caught / bred)', hint: '' },
  { key: 'status', label: 'Status', hint: '"Done", or what is still missing' },
  { key: 'notes', label: 'Notes', hint: '' },
] as const;

export type FieldKey = (typeof FIELDS)[number]['key'];

/** Column index -> field. Columns not present are ignored on import. */
export type ColumnMapping = Record<number, FieldKey>;

/** A spreadsheet row after the mapping has been applied. */
export type MappedRow = Partial<Record<FieldKey, string>>;

const has = (h: string, ...words: string[]) => words.some((w) => h.includes(w));

function guessField(h: string, previous: FieldKey | undefined): FieldKey | undefined {
  if (has(h, 'pokedex', 'dex', 'numero') || h === 'no' || h === 'n') return 'nationalDex';
  if (has(h, 'naturaleza', 'nature', 'menta', 'mint')) {
    return has(h, 'actual', 'current') ? 'currentNature' : 'targetNature';
  }
  if (has(h, 'movimientos', 'moves', 'ataques', 'moveset')) {
    if (has(h, 'actual', 'current')) return 'currentMoves';
    // An unlabelled moves column right after "current nature" holds the current moves.
    return previous === 'currentNature' ? 'currentMoves' : 'targetMoves';
  }
  const slot = h.match(/^(?:movimiento|move|ataque|mov)([1-4])$/)?.[1];
  if (slot) return `move${slot}` as FieldKey;
  if (has(h, 'crianza', 'base', 'breed', 'preevo')) return 'baseSpecies';
  if (has(h, 'pokemon', 'species', 'especie', 'final')) return 'species';
  if (has(h, 'habilidad', 'ability')) return 'ability';
  if (has(h, 'baya', 'berry')) return 'berry';
  if (has(h, 'objeto', 'item')) return 'item';
  if (has(h, 'ev', 'esfuerzo') && !has(h, 'evol', 'nivel', 'level')) {
    return has(h, 'actual', 'current') ? 'currentEvs' : 'evs';
  }
  if (has(h, 'tera')) return 'teraType';
  if (has(h, 'origen', 'origin')) return 'origin';
  if (has(h, 'estado', 'status', 'progreso')) return 'status';
  if (has(h, 'genero', 'gender', 'sexo')) return 'gender';
  if (has(h, 'mote', 'nickname', 'apodo')) return 'nickname';
  if (has(h, 'nota', 'notes', 'comentario')) return 'notes';
  return undefined;
}

/** Guesses a mapping from header names (English or Spanish). Each field is used at most once. */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<FieldKey>();
  let previous: FieldKey | undefined;
  headers.forEach((header, i) => {
    const field = guessField(normalizeKey(header), previous);
    previous = field;
    if (field && !used.has(field)) {
      mapping[i] = field;
      used.add(field);
    }
  });
  return mapping;
}

export function applyMapping(row: string[], mapping: ColumnMapping): MappedRow {
  const out: MappedRow = {};
  for (const [index, field] of Object.entries(mapping)) {
    const value = row[Number(index)]?.trim();
    if (value) out[field] = value;
  }
  return out;
}
