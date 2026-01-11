/*
  Warnings:

  - You are about to drop the column `moves` on the `players` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `players` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MoveResult" AS ENUM ('HIT', 'MISS', 'SUNK');

-- AlterTable
ALTER TABLE "players" DROP COLUMN "moves",
DROP COLUMN "state";

-- CreateTable
CREATE TABLE "moves" (
    "id" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "result" "MoveResult" NOT NULL,
    "player_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ships" (
    "id" TEXT NOT NULL,
    "shipId" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "w" INTEGER NOT NULL,
    "h" INTEGER NOT NULL,
    "health" INTEGER NOT NULL,
    "max_health" INTEGER NOT NULL DEFAULT 1,
    "player_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moves_player_id_idx" ON "moves"("player_id");

-- CreateIndex
CREATE INDEX "ships_player_id_idx" ON "ships"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "ships_player_id_shipId_key" ON "ships"("player_id", "shipId");

-- AddForeignKey
ALTER TABLE "moves" ADD CONSTRAINT "moves_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ships" ADD CONSTRAINT "ships_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
