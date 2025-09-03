import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/components';

import { ConfirmationTemplate } from './templates/confirmation.template';
import { ResetPasswordTemplate } from './templates/reset-password.template';
import { TwoFactorAuthTemplate } from './templates/two-factor-auth.template';

@Injectable()
export class MailService {
  public constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService
  ) {}

  public async sendConfirmationEmail(
    userName: string,
    email: string,
    token: string
  ): Promise<void> {
    const domain = this.configService.getOrThrow<string>('ALLOWED_ORIGIN');
    const html = await render(
      ConfirmationTemplate({ domain, token, userName })
    );

    await this.sendMail(email, 'Email confirmation', html);
  }

  public async sendPasswordResetEmail(
    userName: string,
    email: string,
    token: string
  ): Promise<void> {
    const domain = this.configService.getOrThrow<string>('ALLOWED_ORIGIN');
    const html = await render(
      ResetPasswordTemplate({ domain, token, userName })
    );

    await this.sendMail(email, 'Password reset', html);
  }

  public async sendTwoFactorTokenEmail(
    userName: string,
    email: string,
    token: string
  ): Promise<void> {
    const html = await render(TwoFactorAuthTemplate({ token, userName }));

    await this.sendMail(email, 'Confirming your identity', html);
  }

  private sendMail(email: string, subject: string, html: string) {
    return this.mailerService.sendMail({ to: email, subject, html });
  }
}
