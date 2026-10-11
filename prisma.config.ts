/**
 * Prisma 7 config: connection URL for CLI commands (migrate, studio).
 * The running app never reads this file -- it connects via the driver
 * adapter constructed in src/lib/db.ts. Loads .env.local itself so these
 * commands work from a plain shell.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { defineConfig, env } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
