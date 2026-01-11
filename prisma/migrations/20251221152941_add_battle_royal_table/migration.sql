-- CreateEnum
CREATE TYPE "BattleRoyalUpgradeType" AS ENUM ('EXTRA_LIFE', 'MOVEMENT_BOOST', 'ATTACK_BOOST', 'VISION_BOOST');

-- CreateEnum
CREATE TYPE "BattleRoyalRoomStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "battle_royal_players" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "lives" INTEGER NOT NULL DEFAULT 1,
    "max_lives" INTEGER NOT NULL DEFAULT 1,
    "movement_boost" INTEGER NOT NULL DEFAULT 0,
    "attack_boost" INTEGER NOT NULL DEFAULT 0,
    "vision_radius" INTEGER NOT NULL DEFAULT 3,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "distance_traveled" INTEGER NOT NULL DEFAULT 0,
    "is_alive" BOOLEAN NOT NULL DEFAULT true,
    "eliminated_by" TEXT,
    "elimination_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_royal_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_royal_visible_cells" (
    "id" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "turn" INTEGER NOT NULL,
    "seen_at" TIMESTAMP(3) NOT NULL,
    "player_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_royal_visible_cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_royal_upgrade_slots" (
    "id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "upgrade_type" "BattleRoyalUpgradeType",
    "player_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_royal_upgrade_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_royal_rooms" (
    "id" TEXT NOT NULL,
    "player_turn" TEXT,
    "privacy" "RoomPrivacy" NOT NULL DEFAULT 'PUBLIC',
    "field_size" INTEGER NOT NULL DEFAULT 40,
    "status" "BattleRoyalRoomStatus" NOT NULL DEFAULT 'WAITING',
    "turn_number" INTEGER NOT NULL DEFAULT 0,
    "safe_zone_radius" INTEGER NOT NULL DEFAULT 40,
    "next_shrink_turn" INTEGER,
    "creator_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_royal_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_royal_upgrades" (
    "id" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "upgrade_type" "BattleRoyalUpgradeType" NOT NULL,
    "is_collected" BOOLEAN NOT NULL DEFAULT false,
    "collected_by" TEXT,
    "collected_at" TIMESTAMP(3),
    "room_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_royal_upgrades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_royal_rating_history" (
    "id" TEXT NOT NULL,
    "old_rating" INTEGER NOT NULL,
    "new_rating" INTEGER NOT NULL,
    "rating_change" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_result_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_royal_rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_royal_game_results" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "winner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_royal_game_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "battle_royal_players_room_id_idx" ON "battle_royal_players"("room_id");

-- CreateIndex
CREATE INDEX "battle_royal_visible_cells_player_id_idx" ON "battle_royal_visible_cells"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "battle_royal_visible_cells_player_id_x_y_key" ON "battle_royal_visible_cells"("player_id", "x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "battle_royal_upgrade_slots_player_id_slot_index_key" ON "battle_royal_upgrade_slots"("player_id", "slot_index");

-- CreateIndex
CREATE INDEX "battle_royal_upgrades_room_id_is_collected_idx" ON "battle_royal_upgrades"("room_id", "is_collected");

-- CreateIndex
CREATE UNIQUE INDEX "battle_royal_upgrades_room_id_x_y_key" ON "battle_royal_upgrades"("room_id", "x", "y");

-- AddForeignKey
ALTER TABLE "battle_royal_players" ADD CONSTRAINT "battle_royal_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_players" ADD CONSTRAINT "battle_royal_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "battle_royal_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_visible_cells" ADD CONSTRAINT "battle_royal_visible_cells_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "battle_royal_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_upgrade_slots" ADD CONSTRAINT "battle_royal_upgrade_slots_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "battle_royal_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_rooms" ADD CONSTRAINT "battle_royal_rooms_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_rooms" ADD CONSTRAINT "battle_royal_rooms_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_upgrades" ADD CONSTRAINT "battle_royal_upgrades_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "battle_royal_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_rating_history" ADD CONSTRAINT "battle_royal_rating_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_rating_history" ADD CONSTRAINT "battle_royal_rating_history_game_result_id_fkey" FOREIGN KEY ("game_result_id") REFERENCES "battle_royal_game_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_game_results" ADD CONSTRAINT "battle_royal_game_results_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "battle_royal_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_royal_game_results" ADD CONSTRAINT "battle_royal_game_results_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
