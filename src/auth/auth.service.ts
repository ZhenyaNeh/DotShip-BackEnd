import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthMethod, User } from '@prisma/__generated__';
import { verify } from 'argon2';
import { Request, Response } from 'express';

import { PrismaService } from '@/prisma/prisma.service';
import { UserService } from '@/user/user.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailConfirmationService } from './email-confirmation/email-confirmation.service';
import { ProviderService } from './provider/provider.service';
import { TwoFactorAuthService } from './two-factor-auth/two-factor-auth.service';

@Injectable()
export class AuthService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly providerService: ProviderService,
    private readonly emailConfirmationService: EmailConfirmationService,
    private readonly twoFactorAuthService: TwoFactorAuthService
  ) {}

  public async register(req: Request, dto: RegisterDto) {
    const isExists = await this.userService.findByEmail(dto.email);

    if (isExists) {
      throw new ConflictException(
        'Registration failed. A user with this email already exists.'
      );
    }

    const newUser = await this.userService.create(
      dto.email,
      dto.password,
      dto.name,
      '',
      AuthMethod.CREDENTIALS,
      false
    );

    await this.emailConfirmationService.sendVerificationToken(
      newUser.displayName,
      newUser.email
    );

    return {
      message:
        'You have successfully registered. Please confirm your email. The message has been sent to your email address.',
    };
  }

  public async login(req: Request, dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user || !user.password) {
      throw new NotFoundException(
        'User not found. Please, check the entered data.'
      );
    }

    const isValidPassword = await verify(user.password, dto.password);

    if (!isValidPassword) {
      throw new UnauthorizedException(
        'Incorrect password. Please, try again or recover your password.'
      );
    }

    if (!user.isVerified) {
      await this.emailConfirmationService.sendVerificationToken(
        user.displayName,
        user.email
      );
      throw new UnauthorizedException(
        'Your email is not confirmed. Please check your mail and confirm the address.'
      );
    }

    if (user.isTwoFactorEnable) {
      if (!dto.code) {
        await this.twoFactorAuthService.sendTwoFactorToken(
          user.displayName,
          user.email
        );

        return {
          message: 'Check your email. Two-factor authentication code required.',
        };
      }

      await this.twoFactorAuthService.validateTwoFactorToken(
        user.email,
        dto.code
      );
    }

    return this.saveSession(req, user);
  }

  public async extractProfileFromCode(
    req: Request,
    provider: string,
    code: string
  ) {
    const providerInstance = this.providerService.findByService(provider);
    const profile = await providerInstance?.findUserByCode(code);

    if (!profile) {
      throw new Error('Canon find profile.');
    }

    console.log(profile);

    const account = await this.prismaService.account.findFirst({
      where: { id: profile.id, provider: profile.provider },
    });

    let user = account?.userId
      ? await this.userService.findById(account.userId)
      : null;

    if (user) {
      return this.saveSession(req, user);
    }

    const providerKey =
      profile.provider.toUpperCase() as keyof typeof AuthMethod;

    if (!(providerKey in AuthMethod)) {
      throw new Error(`Unknown provider: ${profile.provider}`);
    }

    const authMethod = AuthMethod[providerKey];

    user = await this.userService.create(
      profile.email,
      '',
      profile.name,
      profile.picture,
      authMethod,
      true
    );

    if (!account) {
      await this.prismaService.account.create({
        data: {
          id: profile.id,
          userId: user.id,
          type: 'oauth',
          provider: profile.provider,
          accessToken: profile.access_token,
          refreshToken: profile.refresh_token,
          expiresAt: profile.expires_at,
        },
      });
    }

    return this.saveSession(req, user);
  }

  public async logout(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, rejects) => {
      req.session.destroy(err => {
        if (err) {
          return rejects(
            new InternalServerErrorException(
              'Failed to end the session. There may be an error with the server or the session has already been deleted.'
            )
          );
        }
        res.clearCookie(this.configService.getOrThrow<string>('SESSION_NAME'));
        resolve();
      });
    });
  }

  public async saveSession(req: Request, user: User) {
    return new Promise((resolve, reject) => {
      req.session.userId = user.id;
      req.session.save(err => {
        if (err) {
          return reject(
            new InternalServerErrorException(
              'Session save error. Check session parameters.'
            )
          );
        }
        resolve(user);
      });
    });
  }
}
