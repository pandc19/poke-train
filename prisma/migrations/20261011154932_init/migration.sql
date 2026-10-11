-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'GENDERLESS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Origin" AS ENUM ('CAUGHT', 'BRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BreedingStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version_group" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "species" (
    "id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_es" TEXT NOT NULL,
    "egg_groups" TEXT[],
    "gender_rate" INTEGER NOT NULL,
    "is_baby" BOOLEAN NOT NULL DEFAULT false,
    "evolves_from_id" INTEGER,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" INTEGER NOT NULL,
    "species_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL,
    "types" TEXT[],
    "base_stats" JSONB NOT NULL,
    "sprite_url" TEXT,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moves" (
    "id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_es" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "damage_class" TEXT NOT NULL,
    "power" INTEGER,
    "accuracy" INTEGER,
    "pp" INTEGER,

    CONSTRAINT "moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learnsets" (
    "id" SERIAL NOT NULL,
    "form_id" INTEGER NOT NULL,
    "move_id" INTEGER NOT NULL,
    "version_group" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "learnsets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abilities" (
    "id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_es" TEXT NOT NULL,

    CONSTRAINT "abilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_abilities" (
    "form_id" INTEGER NOT NULL,
    "ability_id" INTEGER NOT NULL,
    "is_hidden" BOOLEAN NOT NULL,

    CONSTRAINT "form_abilities_pkey" PRIMARY KEY ("form_id","ability_id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_es" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sprite_url" TEXT,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "natures" (
    "id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_es" TEXT NOT NULL,
    "increased" TEXT,
    "decreased" TEXT,

    CONSTRAINT "natures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pokedexes" (
    "id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "game_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pokedexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pokedex_slots" (
    "pokedex_id" INTEGER NOT NULL,
    "species_id" INTEGER NOT NULL,
    "entry_number" INTEGER NOT NULL,

    CONSTRAINT "pokedex_slots_pkey" PRIMARY KEY ("pokedex_id","species_id")
);

-- CreateTable
CREATE TABLE "sync_state" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_profiles" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "game_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pokedex_entries" (
    "profile_id" UUID NOT NULL,
    "species_id" INTEGER NOT NULL,
    "caught_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pokedex_entries_pkey" PRIMARY KEY ("profile_id","species_id")
);

-- CreateTable
CREATE TABLE "roster_pokemon" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "profile_id" UUID NOT NULL,
    "species_id" INTEGER NOT NULL,
    "form_id" INTEGER,
    "base_species_id" INTEGER,
    "nickname" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'UNKNOWN',
    "origin" "Origin" NOT NULL DEFAULT 'UNKNOWN',
    "owned" BOOLEAN NOT NULL DEFAULT false,
    "target_nature_id" INTEGER,
    "current_nature_id" INTEGER,
    "nature_status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "ability_id" INTEGER,
    "ability_status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "item_id" INTEGER,
    "item_note" TEXT,
    "item_status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "evs" JSONB,
    "ev_status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "tera_type" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "import_batch_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_pokemon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_moves" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "roster_pokemon_id" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "move_id" INTEGER,
    "raw_name" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "legal" BOOLEAN,

    CONSTRAINT "roster_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breeding_goals" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "profile_id" UUID NOT NULL,
    "species_id" INTEGER NOT NULL,
    "move_ids" INTEGER[],
    "nature_id" INTEGER,
    "status" "BreedingStatus" NOT NULL DEFAULT 'PLANNED',
    "plan" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breeding_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "profile_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "row_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_audits" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "profile_id" UUID NOT NULL,
    "roster_pokemon_id" UUID,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "species_slug_key" ON "species"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "forms_slug_key" ON "forms"("slug");

-- CreateIndex
CREATE INDEX "forms_species_id_idx" ON "forms"("species_id");

-- CreateIndex
CREATE UNIQUE INDEX "moves_slug_key" ON "moves"("slug");

-- CreateIndex
CREATE INDEX "learnsets_version_group_move_id_method_idx" ON "learnsets"("version_group", "move_id", "method");

-- CreateIndex
CREATE UNIQUE INDEX "learnsets_form_id_move_id_version_group_method_level_key" ON "learnsets"("form_id", "move_id", "version_group", "method", "level");

-- CreateIndex
CREATE UNIQUE INDEX "abilities_slug_key" ON "abilities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "items_slug_key" ON "items"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "natures_slug_key" ON "natures"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "pokedexes_slug_key" ON "pokedexes"("slug");

-- CreateIndex
CREATE INDEX "pokedex_slots_pokedex_id_entry_number_idx" ON "pokedex_slots"("pokedex_id", "entry_number");

-- CreateIndex
CREATE UNIQUE INDEX "game_profiles_user_id_game_id_name_key" ON "game_profiles"("user_id", "game_id", "name");

-- CreateIndex
CREATE INDEX "roster_pokemon_profile_id_sort_order_idx" ON "roster_pokemon"("profile_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "roster_moves_roster_pokemon_id_slot_key" ON "roster_moves"("roster_pokemon_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "ai_audits_kind_provider_input_hash_key" ON "ai_audits"("kind", "provider", "input_hash");

-- AddForeignKey
ALTER TABLE "species" ADD CONSTRAINT "species_evolves_from_id_fkey" FOREIGN KEY ("evolves_from_id") REFERENCES "species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learnsets" ADD CONSTRAINT "learnsets_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learnsets" ADD CONSTRAINT "learnsets_move_id_fkey" FOREIGN KEY ("move_id") REFERENCES "moves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_abilities" ADD CONSTRAINT "form_abilities_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_abilities" ADD CONSTRAINT "form_abilities_ability_id_fkey" FOREIGN KEY ("ability_id") REFERENCES "abilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokedexes" ADD CONSTRAINT "pokedexes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokedex_slots" ADD CONSTRAINT "pokedex_slots_pokedex_id_fkey" FOREIGN KEY ("pokedex_id") REFERENCES "pokedexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokedex_slots" ADD CONSTRAINT "pokedex_slots_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_profiles" ADD CONSTRAINT "game_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_profiles" ADD CONSTRAINT "game_profiles_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokedex_entries" ADD CONSTRAINT "pokedex_entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokedex_entries" ADD CONSTRAINT "pokedex_entries_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_base_species_id_fkey" FOREIGN KEY ("base_species_id") REFERENCES "species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_target_nature_id_fkey" FOREIGN KEY ("target_nature_id") REFERENCES "natures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_current_nature_id_fkey" FOREIGN KEY ("current_nature_id") REFERENCES "natures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_ability_id_fkey" FOREIGN KEY ("ability_id") REFERENCES "abilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_moves" ADD CONSTRAINT "roster_moves_roster_pokemon_id_fkey" FOREIGN KEY ("roster_pokemon_id") REFERENCES "roster_pokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_moves" ADD CONSTRAINT "roster_moves_move_id_fkey" FOREIGN KEY ("move_id") REFERENCES "moves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeding_goals" ADD CONSTRAINT "breeding_goals_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeding_goals" ADD CONSTRAINT "breeding_goals_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audits" ADD CONSTRAINT "ai_audits_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audits" ADD CONSTRAINT "ai_audits_roster_pokemon_id_fkey" FOREIGN KEY ("roster_pokemon_id") REFERENCES "roster_pokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
