import { MailerOptions } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

export const getMailerConfig = (
  configService: ConfigService
): MailerOptions => {
  return {
    transport: {
      host: 'smtp.gmail.com',
      port: configService.getOrThrow<number>('GOOGLE_MAIL_PORT'),
      secure: true,
      auth: {
        user: configService.getOrThrow<string>('GOOGLE_MAIL_LOGIN'),
        pass: configService.getOrThrow<string>('GOOGLE_MAIL_PASSWORD'),
      },
    },
    defaults: {
      from: {
        name: 'DotShip',
        address: configService.getOrThrow<string>('GOOGLE_MAIL_LOGIN'),
      },
    },
  };
};
