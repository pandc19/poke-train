/**
 * Seeds the rows the app assumes exist: the single local user, every game
 * in src/lib/games, and one default profile per game. Idempotent.
 */
import { prisma } from '../src/lib/db';
import { GAMES } from '../src/lib/games';

import { LOCAL_USER_ID } from '../src/lib/constants';

async function main() {
  await prisma.user.upsert({
    where: { id: LOCAL_USER_ID },
    update: {},
    create: { id: LOCAL_USER_ID, name: 'Trainer' },
  });

  for (const [i, game] of GAMES.entries()) {
    const data = {
      name: game.name,
      versionGroup: game.versionGroup,
      generation: game.generation,
      sortOrder: i,
    };
    await prisma.game.upsert({ where: { id: game.id }, update: data, create: { id: game.id, ...data } });
    await prisma.gameProfile.upsert({
      where: { userId_gameId_name: { userId: LOCAL_USER_ID, gameId: game.id, name: 'Main save' } },
      update: {},
      create: { userId: LOCAL_USER_ID, gameId: game.id, name: 'Main save' },
    });
  }

  console.log(`seeded user + ${GAMES.length} game(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
