import { Module } from '@nestjs/common';

import { YandexDiskModule } from '@/libs/common/yandex-storage/yandex-storage.module';
import { YandexDiskService } from '@/libs/common/yandex-storage/yandex-storage.service';

import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [YandexDiskModule],
  controllers: [UserController],
  providers: [UserService, YandexDiskService],
  exports: [UserService],
})
export class UserModule {}
