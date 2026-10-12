import type { Gender, Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Which genders a Pokémon's recorded gender stands for. */
export type Sides = { male: boolean; female: boolean };

export const sidesOf = (gender: Gender): Sides => ({
  male: gender === 'MALE' || gender === 'BOTH',
  female: gender === 'FEMALE' || gender === 'BOTH',
});

/** The recorded gender for a set of sides. Genderless Pokémon stay genderless. */
export function genderOf(sides: Sides, current: Gender): Gender {
  if (sides.male && sides.female) return 'BOTH';
  if (sides.male) return 'MALE';
  if (sides.female) return 'FEMALE';
  return current === 'GENDERLESS' ? 'GENDERLESS' : 'UNKNOWN';
}

/** Only species that can be either gender have a choice to record. */
const isMixed = (genderRate: number) => genderRate > 0 && genderRate < 8;

/**
 * The roster says what gender a Pokémon you have is; the Pokédex says which
 * genders of the species you have. A roster change is carried to the Pokédex,
 * but not the other way: a gender ticked in the Pokédex (a parent you keep
 * outside the roster) never changes a roster Pokémon. Only obtained roster
 * Pokémon take part: a planned one is not in your box yet.
 */

/**
 * Roster -> Pokédex. A gender you add is marked in the Pokédex (which also
 * registers the species as caught). A gender you remove is cleared there
 * unless another obtained roster Pokémon of that species still has it.
 */
export async function rosterGenderToPokedex(
  db: Db,
  args: { profileId: string; speciesId: number; rosterId: string; before: Gender; after: Gender }
): Promise<void> {
  const { profileId, speciesId, rosterId, before, after } = args;
  const species = await db.species.findUnique({ where: { id: speciesId }, select: { genderRate: true } });
  if (!species || !isMixed(species.genderRate)) return;

  const b = sidesOf(before);
  const a = sidesOf(after);
  const others = await db.rosterPokemon.findMany({
    where: { profileId, speciesId, owned: true, id: { not: rosterId } },
    select: { gender: true },
  });
  const stillMale = others.some((o) => sidesOf(o.gender).male);
  const stillFemale = others.some((o) => sidesOf(o.gender).female);

  const data: { hasMale?: boolean; hasFemale?: boolean } = {};
  if (a.male && !b.male) data.hasMale = true;
  else if (b.male && !a.male && !stillMale) data.hasMale = false;
  if (a.female && !b.female) data.hasFemale = true;
  else if (b.female && !a.female && !stillFemale) data.hasFemale = false;
  if (Object.keys(data).length === 0) return;

  if (data.hasMale || data.hasFemale) {
    await db.pokedexEntry.upsert({
      where: { profileId_speciesId: { profileId, speciesId } },
      update: data,
      create: { profileId, speciesId, ...data },
    });
  } else {
    // Only clearing: never create a Pokédex entry just to say "no".
    await db.pokedexEntry.updateMany({ where: { profileId, speciesId }, data });
  }
}
