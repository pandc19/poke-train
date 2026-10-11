/**
 * Deletes every row in the app's tables but keeps the tables themselves, so
 * no migration runs. `npm run db:reset` then re-seeds and re-syncs.
 *
 * It only touches the database named by DATABASE_URL and refuses to run
 * when NODE_ENV is "production".
 */
import { Pool } from 'pg';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to wipe a database when NODE_ENV is "production".');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Create .env.local from .env.local.example.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: db } = await pool.query<{ name: string }>('select current_database() as name');
    // Everything in the schema except Prisma's own migration history.
    const { rows } = await pool.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`
    );
    if (rows.length === 0) {
      throw new Error('No tables found. Run `npm run db:migrate` first.');
    }

    const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    await pool.query(`truncate table ${tables} restart identity cascade`);
    console.log(`Deleted all data from ${rows.length} tables in database "${db[0].name}".`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
