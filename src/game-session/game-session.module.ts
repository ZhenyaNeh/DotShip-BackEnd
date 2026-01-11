import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BattleRoyalRoomModule } from '@/battle-royal-room/battle-royal-room.module';
import { RedisModule } from '@/redis/redis.module';
import { RoomModule } from '@/room/room.module';

import { GameSessionGateway } from './game-session.gateway';
import { GameSessionService } from './game-session.service';

@Module({
  imports: [ConfigModule, RedisModule, RoomModule, BattleRoyalRoomModule],
  providers: [GameSessionService, GameSessionGateway],
  exports: [GameSessionService],
})
export class GameSessionModule {}
