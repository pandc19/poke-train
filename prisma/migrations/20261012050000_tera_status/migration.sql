-- AlterTable
ALTER TABLE "roster_pokemon" ADD COLUMN     "tera_status" "TaskStatus" NOT NULL DEFAULT 'PENDING';

-- A Tera type that was already set counts as done, so Pokémon that were ready stay ready.
UPDATE "roster_pokemon" SET "tera_status" = 'DONE' WHERE "tera_type" IS NOT NULL;
