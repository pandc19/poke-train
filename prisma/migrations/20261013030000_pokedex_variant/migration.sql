-- Caught state per form: Paldea lists Dugtrio, Blueberry lists Alolan Dugtrio.
ALTER TABLE "pokedex_entries" ADD COLUMN "variant" TEXT NOT NULL DEFAULT '';
ALTER TABLE "pokedex_entries" DROP CONSTRAINT "pokedex_entries_pkey";
ALTER TABLE "pokedex_entries" ADD CONSTRAINT "pokedex_entries_pkey" PRIMARY KEY ("profile_id", "species_id", "variant");

-- Species that only the Blueberry Pokédex lists, and only as a regional form (Hisuian Typhlosion),
-- were marked before forms were tracked: those marks belong to the regional form.
UPDATE "pokedex_entries" e
SET "variant" = r.region
FROM (VALUES ('alola'), ('galar'), ('hisui')) AS r(region)
WHERE e."variant" = ''
  AND EXISTS (
    SELECT 1 FROM "forms" f
    WHERE f."species_id" = e."species_id" AND NOT f."is_default" AND f."slug" LIKE '%-' || r.region
  )
  AND EXISTS (
    SELECT 1 FROM "pokedex_slots" s JOIN "pokedexes" d ON d."id" = s."pokedex_id"
    WHERE s."species_id" = e."species_id" AND d."slug" = 'blueberry'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "pokedex_slots" s JOIN "pokedexes" d ON d."id" = s."pokedex_id"
    WHERE s."species_id" = e."species_id" AND d."slug" IN ('paldea', 'kitakami')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "pokedex_entries" o
    WHERE o."profile_id" = e."profile_id" AND o."species_id" = e."species_id" AND o."variant" = r.region
  );
