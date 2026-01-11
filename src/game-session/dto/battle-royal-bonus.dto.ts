import { BattleRoyalUpgradeType } from 'prisma/generated/enums';

export interface BattleRoyalBonusDto {
  slotIndex: number;
  roomId: string;
  upgrade: {
    id: string;
    x: number;
    y: number;
    upgradeType: BattleRoyalUpgradeType;
    isCollected: boolean;
  };
}
