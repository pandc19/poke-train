-- AlterTable
ALTER TABLE "roster_pokemon" ADD COLUMN     "stats_nature_id" INTEGER;

-- The stats already recorded are taken as read under the nature effect in force now (a Mint's, else the nature it has).
UPDATE "roster_pokemon" SET "stats_nature_id" = COALESCE("mint_nature_id", "current_nature_id", "target_nature_id") WHERE "current_stats" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_stats_nature_id_fkey" FOREIGN KEY ("stats_nature_id") REFERENCES "natures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
