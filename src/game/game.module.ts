import { Module } from '@nestjs/common';

import { YandexDiskModule } from '@/libs/common/yandex-storage/yandex-storage.module';
import { NotificationModule } from '@/notification/notification.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

import { GameController } from './game.controller';
import { GameService } from './game.service';

@Module({
  imports: [PrismaModule, UserModule, YandexDiskModule, NotificationModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
