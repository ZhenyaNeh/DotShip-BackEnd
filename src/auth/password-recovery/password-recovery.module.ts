import { Module } from '@nestjs/common';

import { MailModule } from '@/libs/common/mail/mail.module';
import { MailService } from '@/libs/common/mail/mail.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';

@Module({
  imports: [PrismaModule, MailModule, UserModule],
  controllers: [PasswordRecoveryController],
  providers: [PasswordRecoveryService, MailService],
})
export class PasswordRecoveryModule {}
