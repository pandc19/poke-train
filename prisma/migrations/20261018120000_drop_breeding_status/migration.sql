-- Breeding plans no longer have a status: they are made, kept up to date from the Pokédex, roster and
-- breeders, and deleted when done.
ALTER TABLE "breeding_goals" DROP COLUMN "status", DROP COLUMN "frozen";
DROP TYPE "BreedingStatus";
