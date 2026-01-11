/*
  Warnings:

  - You are about to drop the column `descriptions` on the `games` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "games" DROP COLUMN "descriptions",
ADD COLUMN     "description" TEXT;
