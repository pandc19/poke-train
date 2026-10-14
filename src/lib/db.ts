import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { SPANISH_FIXES } from './spanish-fixes';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pgPool: Pool;
};

const pool =
  globalForPrisma.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

/** The game's Spanish name wins over PokéAPI's wherever an ability or move is read (see spanish-fixes.ts). */
const fixSpanish = (row: { slug: string; nameEs: string }) => SPANISH_FIXES[row.slug] ?? row.nameEs;

const create = () =>
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ['warn', 'error'],
  }).$extends({
    result: {
      ability: { nameEs: { needs: { slug: true, nameEs: true }, compute: fixSpanish } },
      move: { nameEs: { needs: { slug: true, nameEs: true }, compute: fixSpanish } },
    },
  });

// The extension only rewrites a name on the way out, so the client keeps the plain `PrismaClient` type
// that the rest of the code (transactions included) is written against.
export const prisma = globalForPrisma.prisma || (create() as unknown as PrismaClient);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
