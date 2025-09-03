import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TokenType } from '@prisma/__generated__';

import { MailService } from '@/libs/common/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TwoFactorAuthService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService
  ) {}

  public async validateTwoFactorToken(email: string, code: string) {
    const existingToken = await this.prismaService.token.findFirst({
      where: {
        email,
        type: TokenType.TWO_FACTOR,
      },
    });

    if (!existingToken) {
      throw new NotFoundException(
        'Two-factor authentication token not found. Please make sure you requested a token for this email address.'
      );
    }

    if (existingToken.token !== code) {
      throw new BadRequestException(
        'Invalid two-factor authentication code. Please check the code you entered and try again.'
      );
    }

    const hasExpired = new Date(existingToken.expiresIn) < new Date();

    if (hasExpired) {
      throw new BadRequestException(
        'The two-factor authentication token has expired. Please request a new token.'
      );
    }

    await this.prismaService.token.delete({
      where: {
        id: existingToken.id,
        type: TokenType.TWO_FACTOR,
      },
    });

    return true;
  }

  public async sendTwoFactorToken(userName: string, email: string) {
    const twoFactorToken = await this.generateTwoFactorToken(email);

    await this.mailService.sendTwoFactorTokenEmail(
      userName,
      twoFactorToken.email,
      twoFactorToken.token
    );

    return true;
  }

  private async generateTwoFactorToken(email: string) {
    const token = Math.floor(
      Math.random() * (1000000 - 100000) + 100000
    ).toString();
    const expiresIn = new Date(new Date().getTime() + 600 * 1000);

    const existingToken = await this.prismaService.token.findFirst({
      where: {
        email,
        type: TokenType.TWO_FACTOR,
      },
    });

    if (existingToken) {
      await this.prismaService.token.delete({
        where: {
          id: existingToken.id,
          type: TokenType.TWO_FACTOR,
        },
      });
    }

    const twoFactorToken = await this.prismaService.token.create({
      data: {
        email,
        token,
        expiresIn,
        type: TokenType.TWO_FACTOR,
      },
    });

    return twoFactorToken;
  }
}
