import { User } from 'prisma/generated/client';
import {
  BattleRoyalRoomStatus,
  BattleRoyalUpgradeType,
} from 'prisma/generated/enums';

type UserWithoutPassword = Omit<User, 'password'>;

export interface BattleRoyalGameData {
  room: {
    id: string;
    status: BattleRoyalRoomStatus;
    turnNumber: number;
    fieldSize: number;
    playerTurn: string;
    safeZoneRadius: number;
    nextShrinkTurn: number;
    isMyTurn: boolean;
  };
  myPlayer: {
    id: string;
    user: UserWithoutPassword;
    x: number;
    y: number;
    lives: number;
    maxLives: number;
    remainingMoves: number;
    remainingAttacks: number;
    movementBoost: number;
    attackBoost: number;
    visionRadius: number;
    upgradeSlots: Array<{
      slotIndex: number;
      upgradeType: BattleRoyalUpgradeType;
    }>;
    visibleCells: Array<{ x: number; y: number }>;
  };
  otherPlayers: Array<{
    id: string;
    user: UserWithoutPassword;
    x: number;
    y: number;
    lives: number;
    isAlive: boolean;
  }>;
  upgrades: Array<{
    id: string;
    x: number;
    y: number;
    upgradeType: BattleRoyalUpgradeType;
    isCollected: boolean;
  }>;
  visibleUpgrades: Array<{
    id: string;
    x: number;
    y: number;
    upgradeType: BattleRoyalUpgradeType;
    isCollected: boolean;
  }>;
}
