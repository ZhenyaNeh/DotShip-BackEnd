import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

import { BattleRoyalRoomController } from './battle-royal-room.controller';
import { BattleRoyalRoomService } from './battle-royal-room.service';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [BattleRoyalRoomController],
  providers: [BattleRoyalRoomService],
  exports: [BattleRoyalRoomService],
})
export class BattleRoyalRoomModule {}
