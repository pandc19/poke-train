/**
 * Things the importer wants the player to look at. They are returned as a
 * code plus values so the interface can show them in the selected language.
 * The English text is also the translation key.
 */
export const ISSUE_TEXT = {
  unknownSpecies: 'Unknown Pokémon "{value}"',
  unknownBaseSpecies: 'Unknown base Pokémon "{value}"',
  readSpeciesAs: 'Read "{value}" as {name}',
  tooManyMoves: 'More than 4 moves listed; kept the first 4',
  unknownMove: 'Unknown move "{value}"',
  readMoveAs: 'Read move "{value}" as {name}',
  statusNoMove: 'Status "{value}" did not match any listed move',
  unknownNature: 'Unknown nature "{value}"',
  unknownCurrentNature: 'Unknown current nature "{value}"',
  unknownAbility: 'Unknown ability "{value}"',
  unknownItem: 'Unknown item "{value}"',
  badEvs: 'Could not read EV spread "{value}"',
  unknownTera: 'Unknown Tera type "{value}"',
  noSpecies: 'No Pokémon could be identified; this row will be skipped',
} as const;

export type IssueCode = keyof typeof ISSUE_TEXT;

export type Issue = { code: IssueCode; value?: string; name?: string };

/** The English text of an issue, for tests and logs. The UI translates ISSUE_TEXT[code]. */
export function describeIssue(issue: Issue): string {
  return ISSUE_TEXT[issue.code]
    .replace('{value}', issue.value ?? '')
    .replace('{name}', issue.name ?? '');
}
