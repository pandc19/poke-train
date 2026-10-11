import type { TaskStatus } from '../roster-status';
import { parseEvs, type EvSpread } from './evs';
import type { MappedRow } from './fields';
import type { Match, Matcher } from './matcher';
import { normalizeKey, splitAlternatives, splitList, stripParens } from './text';
import { TYPE_NAMES_ES, TYPE_SLUGS } from '../pokemon-types';

export type Dictionaries = {
  species: Matcher;
  speciesById: (id: number) => Match | null;
  moves: Matcher;
  items: Matcher;
  abilities: Matcher;
  natures: Matcher;
};

export type ResolvedMove = { slot: number; raw: string; match: Match | null; status: TaskStatus };

export type ResolvedRow = {
  /** Position in the uploaded sheet, for messages. */
  index: number;
  species: Match | null;
  baseSpecies: Match | null;
  nickname: string | null;
  gender: 'MALE' | 'FEMALE' | 'GENDERLESS' | 'UNKNOWN';
  origin: 'CAUGHT' | 'BRED' | 'UNKNOWN';
  owned: boolean;
  targetNature: Match | null;
  currentNature: Match | null;
  natureStatus: TaskStatus;
  ability: Match | null;
  abilityStatus: TaskStatus;
  item: Match | null;
  itemNote: string | null;
  itemStatus: TaskStatus;
  evs: EvSpread | null;
  evStatus: TaskStatus;
  teraType: string | null;
  moves: ResolvedMove[];
  notes: string | null;
  /** Things the user should look at. A row without a species cannot be imported. */
  issues: string[];
  importable: boolean;
};

const DONE_WORDS = ['listo', 'lista', 'done', 'complete', 'completo', 'completado', 'ready', 'ok', 'terminado'];
const NONE_WORDS = ['ninguna', 'ninguno', 'none', 'na', 'no'];

function parseGender(raw: string | undefined): ResolvedRow['gender'] {
  const k = normalizeKey(raw ?? '');
  if (!k) return 'UNKNOWN';
  if (raw!.includes('♂') || ['m', 'male', 'macho', 'masculino'].includes(k)) return 'MALE';
  if (raw!.includes('♀') || ['f', 'female', 'hembra', 'femenino'].includes(k)) return 'FEMALE';
  if (k.startsWith('sin') || k.startsWith('genderless')) return 'GENDERLESS';
  return 'UNKNOWN';
}

function parseOrigin(raw: string | undefined): ResolvedRow['origin'] {
  const k = normalizeKey(raw ?? '');
  if (['criado', 'criada', 'bred', 'huevo', 'egg', 'hatched'].some((w) => k.includes(w))) return 'BRED';
  if (['encontrado', 'capturado', 'caught', 'wild', 'salvaje', 'atrapado'].some((w) => k.includes(w))) return 'CAUGHT';
  return 'UNKNOWN';
}

function parseTeraType(raw: string | undefined): string | null {
  const k = normalizeKey(raw ?? '');
  if (!k) return null;
  return TYPE_SLUGS.find((t) => t === k || normalizeKey(TYPE_NAMES_ES[t]) === k) ?? null;
}

/** "Falta golpe bajo" / "Missing: Tailwind and Hurricane" -> the missing things, or null if not such a note. */
function parseMissing(status: string): string[] | null {
  const m = status.match(/^\s*(?:fal[a-z]*ta[n]?|missing|needs?|pending|pendiente[s]?)\s*:?\s*(.+)$/i);
  if (!m) return null;
  const whole = m[1].trim();
  const parts = whole
    .split(/\s+(?:y|and|e)\s+|[,;/]/i)
    .map((p) => p.trim())
    .filter(Boolean);
  // The whole text is tried too: some move names contain "y" ("Ida y Vuelta").
  return [...new Set([whole, ...parts])];
}

/**
 * Turns one mapped spreadsheet row into a roster entry, resolving names and
 * deciding which micro-tasks are already done.
 *
 * Obtained: with a status column, a blank status means "not obtained yet".
 *
 * Status rules, in order:
 *  - Status says "done" -> everything is DONE.
 *  - Status says "missing X and Y" -> those moves are PENDING, the rest DONE.
 *  - Otherwise moves copied from the "current" columns are DONE (the Pokémon
 *    already knows them) and moves from the "recommended" columns are PENDING.
 *  - Nature is DONE when the current nature equals the recommended one.
 *  - Ability, item and EVs are DONE only when the row is marked done.
 *
 * When "current" moves exist they are the build that gets tracked and the
 * recommended list is dropped: the AI audit proposes a recommended set on demand.
 */
export type InterpretOptions = {
  /**
   * The sheet has a status column. When it does, a blank status means "I do
   * not have this one yet", and any status text means the Pokémon is in hand.
   */
  statusColumn?: boolean;
};

export function interpretRow(
  row: MappedRow,
  index: number,
  dict: Dictionaries,
  options: InterpretOptions = {}
): ResolvedRow {
  const issues: string[] = [];

  // --- species ---
  const dexNumber = Number((row.nationalDex ?? '').replace(/\D/g, '')) || null;
  const byNumber = dexNumber ? dict.speciesById(dexNumber) : null;
  let species = row.species ? dict.species(row.species) : null;
  let baseSpecies = row.baseSpecies ? dict.species(row.baseSpecies) : null;
  if (row.species && !species) issues.push(`Unknown Pokémon "${row.species}"`);
  if (row.baseSpecies && !baseSpecies) issues.push(`Unknown base Pokémon "${row.baseSpecies}"`);
  // The dex number backs up whichever name is missing or unreadable.
  if (!baseSpecies && byNumber && species?.id !== byNumber.id) baseSpecies = byNumber;
  if (!species) species = baseSpecies ?? byNumber;
  if (species && !species.exact && row.species) {
    issues.push(`Read "${row.species}" as ${species.nameEn}`);
  }

  // --- status text ---
  const statusKey = normalizeKey(row.status ?? '');
  const allDone = DONE_WORDS.includes(statusKey);
  const missing = row.status && !allDone ? parseMissing(row.status) : null;
  const statusNote = row.status && !allDone && !missing ? row.status : null;

  // --- moves ---
  const slotMoves = [row.move1, row.move2, row.move3, row.move4].filter((m): m is string => !!m);
  const currentList = row.currentMoves ? splitList(row.currentMoves) : [];
  const targetList = slotMoves.length ? slotMoves : row.targetMoves ? splitList(row.targetMoves) : [];
  const usingCurrent = currentList.length > 0;
  const moveNames = (usingCurrent ? currentList : targetList).slice(0, 4);
  if ((usingCurrent ? currentList : targetList).length > 4) issues.push('More than 4 moves listed; kept the first 4');

  const missingKeys = (missing ?? []).map(normalizeKey);
  const missingMatches = (missing ?? []).map((m) => dict.moves(m)?.id).filter((id) => id != null);
  const moves: ResolvedMove[] = moveNames.map((raw, i) => {
    const match = dict.moves(raw);
    if (!match) issues.push(`Unknown move "${raw}"`);
    else if (!match.exact) issues.push(`Read move "${raw}" as ${match.nameEn}`);
    const isMissing = missingKeys.includes(normalizeKey(raw)) || (match != null && missingMatches.includes(match.id));
    const status: TaskStatus = allDone ? 'DONE' : isMissing ? 'PENDING' : usingCurrent ? 'DONE' : 'PENDING';
    return { slot: i + 1, raw, match, status };
  });
  if (missing && !moves.some((m) => m.status === 'PENDING')) {
    issues.push(`Status "${row.status}" did not match any listed move`);
  }

  // --- nature ---
  const natureOptions = row.targetNature ? splitAlternatives(row.targetNature) : [];
  const targetNature = natureOptions.length ? dict.natures(natureOptions[0]) : null;
  if (row.targetNature && !targetNature) issues.push(`Unknown nature "${row.targetNature}"`);
  const currentNature = row.currentNature ? dict.natures(stripParens(row.currentNature)) : null;
  if (row.currentNature && !currentNature) issues.push(`Unknown current nature "${row.currentNature}"`);
  const natureMatches =
    currentNature != null && natureOptions.some((option) => dict.natures(option)?.id === currentNature.id);
  const natureStatus: TaskStatus = allDone || natureMatches ? 'DONE' : 'PENDING';

  // --- ability ---
  const abilityRaw = row.ability && !NONE_WORDS.includes(normalizeKey(row.ability)) ? stripParens(row.ability) : '';
  const ability = abilityRaw ? dict.abilities(abilityRaw) : null;
  if (abilityRaw && !ability) issues.push(`Unknown ability "${abilityRaw}"`);

  // --- item ---
  const itemRaw = row.item ?? row.berry ?? '';
  const itemOptions = itemRaw ? splitAlternatives(itemRaw) : [];
  const item = itemOptions.length ? dict.items(itemOptions[0]) : null;
  if (itemOptions.length && !item) issues.push(`Unknown item "${itemOptions[0]}"`);
  // Keep the cell's own wording when it says more than the matched item does.
  const itemNote = itemOptions.length > 1 || (itemRaw && !item) ? stripParens(itemRaw) : null;

  // --- EVs ---
  const evs = row.evs ? parseEvs(row.evs) : null;
  if (row.evs && !evs) issues.push(`Could not read EV spread "${row.evs}"`);

  const teraType = parseTeraType(row.teraType);
  if (row.teraType && !teraType) issues.push(`Unknown Tera type "${row.teraType}"`);

  const origin = parseOrigin(row.origin);
  // With a status column the sheet says it outright. Without one, fall back to
  // whatever suggests the Pokémon exists: a done status, an origin, or current data.
  const owned = options.statusColumn
    ? Boolean(row.status?.trim())
    : allDone || origin !== 'UNKNOWN' || usingCurrent || currentNature != null;

  const notes =
    [
      row.notes,
      statusNote && `Status: ${statusNote}`,
      natureOptions.length > 1 ? `Nature options: ${natureOptions.join(' / ')}` : null,
      abilityRaw && !ability ? `Ability: ${abilityRaw}` : null,
    ]
      .filter(Boolean)
      .join('\n') || null;

  if (!species) issues.unshift('No Pokémon could be identified; this row will be skipped');

  return {
    index,
    species,
    baseSpecies: baseSpecies && baseSpecies.id !== species?.id ? baseSpecies : null,
    nickname: row.nickname ?? null,
    gender: parseGender(row.gender),
    origin,
    owned,
    targetNature,
    currentNature,
    natureStatus,
    ability,
    abilityStatus: allDone ? 'DONE' : 'PENDING',
    item,
    itemNote,
    itemStatus: allDone ? 'DONE' : 'PENDING',
    evs,
    evStatus: allDone ? 'DONE' : 'PENDING',
    teraType,
    moves,
    notes,
    issues,
    importable: species != null,
  };
}
