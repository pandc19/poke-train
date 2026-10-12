-- AlterTable
ALTER TABLE "roster_pokemon" ADD COLUMN     "current_stats" JSONB,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 100;
