-- CreateEnum
CREATE TYPE "PokemonRole" AS ENUM ('ROSTER', 'BREEDER');

-- CreateTable
CREATE TABLE "pokemon_roles" (
    "roster_pokemon_id" UUID NOT NULL,
    "role" "PokemonRole" NOT NULL,

    CONSTRAINT "pokemon_roles_pkey" PRIMARY KEY ("roster_pokemon_id","role")
);

-- AddForeignKey
ALTER TABLE "pokemon_roles" ADD CONSTRAINT "pokemon_roles_roster_pokemon_id_fkey" FOREIGN KEY ("roster_pokemon_id") REFERENCES "roster_pokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Everything that exists today is on the trained roster.
INSERT INTO "pokemon_roles" ("roster_pokemon_id", "role") SELECT "id", 'ROSTER' FROM "roster_pokemon";

-- AlterTable
ALTER TABLE "breeding_goals" ADD COLUMN "iv_targets" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hidden_ability" BOOLEAN NOT NULL DEFAULT false;
