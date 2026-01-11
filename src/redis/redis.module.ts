import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CleanupSessionsCron } from './cleanup-sessions.cron';
import { MatchmakingRedisService } from './matchmaking-redis.service';
import { RedisBaseService } from './redis-base.service';
import { SocketSessionService } from './socket-session.service';

@Module({
  imports: [ConfigModule],
  providers: [
    RedisBaseService,
    SocketSessionService,
    MatchmakingRedisService,
    CleanupSessionsCron,
  ],
  exports: [SocketSessionService, MatchmakingRedisService],
})
export class RedisModule {}
