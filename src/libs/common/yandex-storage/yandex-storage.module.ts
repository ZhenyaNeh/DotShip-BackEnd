import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { YandexDiskService } from './yandex-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [YandexDiskService],
  exports: [YandexDiskService],
})
export class YandexDiskModule {}
