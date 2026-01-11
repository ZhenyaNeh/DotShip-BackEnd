import { Module } from '@nestjs/common';

import { MailModule } from '@/libs/common/mail/mail.module';
import { MailService } from '@/libs/common/mail/mail.service';
import { PrismaModule } from '@/prisma/prisma.module';

import { TwoFactorAuthService } from './two-factor-auth.service';

@Module({
  imports: [PrismaModule, MailModule],
  providers: [TwoFactorAuthService, MailService],
})
export class TwoFactorAuthModule {}
