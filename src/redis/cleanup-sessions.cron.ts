import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SocketSessionService } from './socket-session.service';
import { WebSocketServerTypes } from './types/web-sockets.types';

@Injectable()
export class CleanupSessionsCron {
  constructor(private readonly socketSessionService: SocketSessionService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCleanup() {
    await this.socketSessionService.cleanupStaleSessions(
      WebSocketServerTypes.MATCHMAKING
    );
    await this.socketSessionService.cleanupStaleSessions(
      WebSocketServerTypes.GAME_SESSION
    );
    await this.socketSessionService.cleanupStaleSessions(
      WebSocketServerTypes.NOTIFICATION
    );
  }
}
