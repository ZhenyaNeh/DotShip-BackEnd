import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}
