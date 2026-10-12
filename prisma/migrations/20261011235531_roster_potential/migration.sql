-- CreateEnum
CREATE TYPE "Potential" AS ENUM ('NO_GOOD', 'DECENT', 'PRETTY_GOOD', 'VERY_GOOD', 'FANTASTIC', 'BEST');

-- AlterTable
ALTER TABLE "roster_pokemon" ADD COLUMN     "potential" "Potential";
