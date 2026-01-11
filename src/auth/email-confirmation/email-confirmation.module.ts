import { forwardRef, Module } from '@nestjs/common';

import { MailModule } from '@/libs/common/mail/mail.module';
import { MailService } from '@/libs/common/mail/mail.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

import { AuthModule } from '../auth.module';

import { EmailConfirmationController } from './email-confirmation.controller';
import { EmailConfirmationService } from './email-confirmation.service';

@Module({
  imports: [PrismaModule, MailModule, UserModule, forwardRef(() => AuthModule)],
  controllers: [EmailConfirmationController],
  providers: [EmailConfirmationService, MailService],
  exports: [EmailConfirmationService],
})
export class EmailConfirmationModule {}
