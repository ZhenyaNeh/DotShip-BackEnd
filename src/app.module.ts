import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './auth/auth.module';
import { EmailConfirmationModule } from './auth/email-confirmation/email-confirmation.module';
import { PasswordRecoveryModule } from './auth/password-recovery/password-recovery.module';
import { ProviderModule } from './auth/provider/provider.module';
import { TwoFactorAuthModule } from './auth/two-factor-auth/two-factor-auth.module';
import { BattleRoyalRoomModule } from './battle-royal-room/battle-royal-room.module';
import { FriendModule } from './friend/friend.module';
import { GameSessionModule } from './game-session/game-session.module';
import { GameModule } from './game/game.module';
import { MailModule } from './libs/common/mail/mail.module';
import { IS_DEV_ENV } from './libs/common/utils/is-dev.util';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { NotificationModule } from './notification/notification.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RoomModule } from './room/room.module';
import { StatisticsModule } from './statistics/statistics.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      ignoreEnvFile: !IS_DEV_ENV,
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    ProviderModule,
    MailModule,
    EmailConfirmationModule,
    PasswordRecoveryModule,
    TwoFactorAuthModule,
    FriendModule,
    GameModule,
    MatchmakingModule,
    RoomModule,
    RedisModule,
    GameSessionModule,
    NotificationModule,
    BattleRoyalRoomModule,
    StatisticsModule,
  ],
})
export class AppModule {}
