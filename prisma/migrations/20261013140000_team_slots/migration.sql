-- CreateTable
CREATE TABLE "team_slots" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "profile_id" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "roster_pokemon_id" UUID NOT NULL,

    CONSTRAINT "team_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_slots_profile_id_slot_key" ON "team_slots"("profile_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "team_slots_roster_pokemon_id_key" ON "team_slots"("roster_pokemon_id");

-- AddForeignKey
ALTER TABLE "team_slots" ADD CONSTRAINT "team_slots_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_slots" ADD CONSTRAINT "team_slots_roster_pokemon_id_fkey" FOREIGN KEY ("roster_pokemon_id") REFERENCES "roster_pokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
