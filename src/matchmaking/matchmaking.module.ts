import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BattleRoyalRoomModule } from '@/battle-royal-room/battle-royal-room.module';
import { GameModule } from '@/game/game.module';
import { RedisModule } from '@/redis/redis.module';
import { RoomModule } from '@/room/room.module';

import { MatchmakingGateway } from './matchmaking.gateway';
import { MatchmakingService } from './matchmaking.service';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    RoomModule,
    BattleRoyalRoomModule,
    GameModule,
  ],
  providers: [MatchmakingService, MatchmakingGateway],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
