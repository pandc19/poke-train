-- The column was added by 20261012070000_hidden_evs and dropped again by 20261013013453
-- (generated while the schema did not have it); the schema has it, so it comes back.
ALTER TABLE "roster_pokemon" ADD COLUMN IF NOT EXISTS "hidden_evs" JSONB;
