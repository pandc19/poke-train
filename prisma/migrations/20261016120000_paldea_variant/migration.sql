-- Paldean Tauros and Wooper became a form of their own in the Pokédex ('paldea'), apart from the
-- normal one. Until now both shared the '' entry, so keep what the player had marked on both cards.
INSERT INTO "pokedex_entries" ("profile_id", "species_id", "variant", "caught_at", "owned", "has_male", "has_female")
SELECT e."profile_id", e."species_id", 'paldea', e."caught_at", e."owned", e."has_male", e."has_female"
FROM "pokedex_entries" e
WHERE e."variant" = ''
  AND e."species_id" IN (SELECT DISTINCT "species_id" FROM "forms" WHERE "slug" LIKE '%-paldea%')
ON CONFLICT DO NOTHING;
