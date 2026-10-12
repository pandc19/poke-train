-- AlterTable
ALTER TABLE "forms" ADD COLUMN "ev_yield" JSONB;

-- AlterTable
ALTER TABLE "species" ADD COLUMN "is_special" BOOLEAN NOT NULL DEFAULT false;
