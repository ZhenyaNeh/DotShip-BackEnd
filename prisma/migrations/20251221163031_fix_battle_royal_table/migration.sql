/*
  Warnings:

  - You are about to drop the column `seen_at` on the `battle_royal_visible_cells` table. All the data in the column will be lost.
  - You are about to drop the column `turn` on the `battle_royal_visible_cells` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "battle_royal_visible_cells" DROP COLUMN "seen_at",
DROP COLUMN "turn";
