import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';

import { Authorization } from '@/auth/decorators/auth.decorator';
import { Authorized } from '@/auth/decorators/authorized.decorator';

import { RoomService } from './room.service';

@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Authorization()
  @Get('initial-state/:roomId')
  @HttpCode(HttpStatus.OK)
  public async getInitialGameState(
    @Authorized('id') userId: string,
    @Param('roomId') roomId: string
  ) {
    return await this.roomService.getInitialGameState(roomId, userId);
  }
}
