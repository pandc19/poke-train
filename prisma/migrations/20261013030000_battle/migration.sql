-- CreateEnum
CREATE TYPE "BattleKind" AS ENUM ('RAID', 'STANDARD');

-- CreateTable
CREATE TABLE "type_effects" (
    "attacker" TEXT NOT NULL,
    "defender" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "type_effects_pkey" PRIMARY KEY ("attacker","defender")
);

-- CreateTable
CREATE TABLE "battle_opponents" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "profile_id" UUID NOT NULL,
    "species_id" INTEGER NOT NULL,
    "form_id" INTEGER,
    "kind" "BattleKind" NOT NULL DEFAULT 'STANDARD',
    "tera_type" TEXT,
    "stars" INTEGER,
    "ability_id" INTEGER,
    "label" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_opponents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "battle_opponents_profile_id_idx" ON "battle_opponents"("profile_id");

-- AddForeignKey
ALTER TABLE "battle_opponents" ADD CONSTRAINT "battle_opponents_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_opponents" ADD CONSTRAINT "battle_opponents_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
