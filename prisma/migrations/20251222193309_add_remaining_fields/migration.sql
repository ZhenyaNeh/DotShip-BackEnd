-- AlterTable
ALTER TABLE "battle_royal_players" ADD COLUMN     "remaining_attacks" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "remaining_moves" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "battle_royal_rooms" ALTER COLUMN "field_size" SET DEFAULT 20,
ALTER COLUMN "safe_zone_radius" SET DEFAULT 20;
