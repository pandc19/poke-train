-- A Mint is chosen first and given later. Until now a recorded Mint always meant it had been given,
-- so those stay marked as given.
ALTER TABLE "roster_pokemon" ADD COLUMN "mint_status" "TaskStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "roster_pokemon" SET "mint_status" = 'DONE' WHERE "mint_nature_id" IS NOT NULL;
