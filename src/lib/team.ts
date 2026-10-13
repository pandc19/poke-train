import { prisma } from './db';
import { TEAM_SIZE } from './team-size';

export { TEAM_SIZE };

/** The roster Pokémon ids of the team, by slot (index 0 is slot 1); null where a slot is empty. */
export async function loadTeam(profileId: string): Promise<(string | null)[]> {
  const rows = await prisma.teamSlot.findMany({ where: { profileId }, select: { slot: true, rosterPokemonId: true } });
  const team: (string | null)[] = Array.from({ length: TEAM_SIZE }, () => null);
  for (const r of rows) if (r.slot >= 1 && r.slot <= TEAM_SIZE) team[r.slot - 1] = r.rosterPokemonId;
  return team;
}
