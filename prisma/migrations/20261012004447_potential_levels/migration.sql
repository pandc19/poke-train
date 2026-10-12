-- The Judge's overall potential has four levels (aceptable, superior a la media, notable,
-- extraordinario), not the six per-stat words used before. Nothing is carried over: the old
-- values were a different scale, so any that were set go back to "not judged".
CREATE TYPE "Potential_new" AS ENUM ('DECENT', 'ABOVE_AVERAGE', 'RELATIVELY_SUPERIOR', 'OUTSTANDING');

ALTER TABLE "roster_pokemon"
  ALTER COLUMN "potential" TYPE "Potential_new"
  USING (NULL::"Potential_new");

DROP TYPE "Potential";
ALTER TYPE "Potential_new" RENAME TO "Potential";
