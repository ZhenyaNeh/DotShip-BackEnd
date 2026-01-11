import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';

import { Authorization } from '@/auth/decorators/auth.decorator';
import { Authorized } from '@/auth/decorators/authorized.decorator';

import { BattleRoyalRoomService } from './battle-royal-room.service';

@Controller('battle-royal-room')
export class BattleRoyalRoomController {
  constructor(
    private readonly battleRoyalRoomService: BattleRoyalRoomService
  ) {}

  @Authorization()
  @Get('initial-state/:roomId')
  @HttpCode(HttpStatus.OK)
  public async getBattleRoyalGameData(
    @Authorized('id') userId: string,
    @Param('roomId') roomId: string
  ) {
    return await this.battleRoyalRoomService.getBattleRoyalGameData(
      roomId,
      userId
    );
  }

  @Authorization()
  @Get('game-over/:roomId')
  @HttpCode(HttpStatus.OK)
  public async getGameResults(@Param('roomId') roomId: string) {
    return await this.battleRoyalRoomService.getGameResults(roomId);
  }
}
