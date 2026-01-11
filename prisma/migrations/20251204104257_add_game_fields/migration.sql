-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('CLASSIC', 'EVENTS', 'BATTLE_ROYAL');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "categories" TEXT[],
ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "estimated_time" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "game_mode" "GameMode" NOT NULL DEFAULT 'CLASSIC',
ADD COLUMN     "is_visible" BOOLEAN NOT NULL DEFAULT true;
