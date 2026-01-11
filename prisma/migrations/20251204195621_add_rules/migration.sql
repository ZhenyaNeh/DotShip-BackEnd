/*
  Warnings:

  - You are about to drop the column `categories` on the `games` table. All the data in the column will be lost.
  - You are about to drop the column `rules` on the `games` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "games" DROP COLUMN "categories",
DROP COLUMN "rules";

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
