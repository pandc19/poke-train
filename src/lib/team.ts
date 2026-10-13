import { prisma } from './db';
import { TEAM_SIZE } from './team-size';

export { TEAM_SIZE };

export const TRAINING_STATS = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const;
export type TrainingStat = (typeof TRAINING_STATS)[number];

/** The stat the team is being trained in, if one is chosen. */
export async function loadTrainingStat(profileId: string): Promise<TrainingStat | null> {
  const row = await prisma.gameProfile.findUnique({ where: { id: profileId }, select: { trainingStat: true } });
  return TRAINING_STATS.find((s) => s === row?.trainingStat) ?? null;
}

/** The roster Pokémon ids of the team, by slot (index 0 is slot 1); null where a slot is empty. */
export async function loadTeam(profileId: string): Promise<(string | null)[]> {
  const rows = await prisma.teamSlot.findMany({ where: { profileId }, select: { slot: true, rosterPokemonId: true } });
  const team: (string | null)[] = Array.from({ length: TEAM_SIZE }, () => null);
  for (const r of rows) if (r.slot >= 1 && r.slot <= TEAM_SIZE) team[r.slot - 1] = r.rosterPokemonId;
  return team;
}
