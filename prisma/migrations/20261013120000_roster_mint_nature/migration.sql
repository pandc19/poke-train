-- AlterTable
ALTER TABLE "roster_pokemon" ADD COLUMN     "mint_nature_id" INTEGER;

-- AddForeignKey
ALTER TABLE "roster_pokemon" ADD CONSTRAINT "roster_pokemon_mint_nature_id_fkey" FOREIGN KEY ("mint_nature_id") REFERENCES "natures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
