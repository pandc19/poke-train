-- AlterTable
ALTER TABLE "roster_pokemon" ADD COLUMN     "final_species_id" INTEGER;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_final_species_id_fkey" FOREIGN KEY ("final_species_id") REFERENCES "species"("id") ON DELETE SET NULL ON UPDATE CASCADE;
