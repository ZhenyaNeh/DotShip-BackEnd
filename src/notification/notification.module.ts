import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { FriendModule } from '@/friend/friend.module';
import { RedisModule } from '@/redis/redis.module';
import { RoomModule } from '@/room/room.module';
import { UserModule } from '@/user/user.module';

import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Module({
  imports: [ConfigModule, RedisModule, RoomModule, FriendModule, UserModule],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService],
})
export class NotificationModule {}
