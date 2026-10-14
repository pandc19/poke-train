import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { applySpanishFixes } from './spanish-fixes';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pgPool: Pool;
};

const pool =
  globalForPrisma.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

const create = () =>
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ['warn', 'error'],
  }).$extends({
    query: {
      // The game's Spanish name wins over PokéAPI's wherever names are read (see spanish-fixes.ts).
      // Results stay plain objects, which the pages pass on to client components.
      $allModels: {
        async $allOperations({ args, query }) {
          return applySpanishFixes(await query(args));
        },
      },
    },
  });

export const prisma = globalForPrisma.prisma || (create() as unknown as PrismaClient);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
