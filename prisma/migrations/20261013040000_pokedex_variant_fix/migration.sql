-- Blueberry lists the Hisuian starters as their normal forms, not Hisuian ones: undo the move of their marks.
UPDATE "pokedex_entries" e
SET "variant" = ''
WHERE e."variant" = 'hisui'
  AND e."species_id" IN (157, 503, 724)
  AND NOT EXISTS (
    SELECT 1 FROM "pokedex_entries" o
    WHERE o."profile_id" = e."profile_id" AND o."species_id" = e."species_id" AND o."variant" = ''
  );
