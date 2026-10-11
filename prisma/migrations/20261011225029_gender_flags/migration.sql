-- AlterEnum
ALTER TYPE "Gender" ADD VALUE 'BOTH';

-- AlterTable
ALTER TABLE "pokedex_entries" ADD COLUMN     "has_female" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_male" BOOLEAN NOT NULL DEFAULT false;
