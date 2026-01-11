import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { GameMode, UserRole } from 'prisma/generated/enums';

import { Authorization } from '@/auth/decorators/auth.decorator';

import { StatisticsService } from './statistics.service';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Authorization()
  @Get('user-stats/:userId')
  @HttpCode(HttpStatus.OK)
  public async getUserStats(@Param('userId') userId: string) {
    return await this.statisticsService.getUserStats(userId);
  }

  @Authorization()
  @Get('rating-progression/:userId')
  @HttpCode(HttpStatus.OK)
  public async getRatingProgression(@Param('userId') userId: string) {
    return await this.statisticsService.getRatingProgression(userId);
  }

  @Authorization()
  @Get('last-games/:userId')
  @HttpCode(HttpStatus.OK)
  public async getLastGames(@Param('userId') userId: string) {
    return await this.statisticsService.getLastGames(userId);
  }

  @Authorization(UserRole.ADMIN)
  @Get('non-admin-users')
  @HttpCode(HttpStatus.OK)
  public async getAllNonAdminUsers() {
    return await this.statisticsService.getAllNonAdminUsers();
  }

  @Authorization(UserRole.ADMIN)
  @Get('active-games')
  @HttpCode(HttpStatus.OK)
  public async getActiveGames() {
    return await this.statisticsService.getActiveGames();
  }

  @Authorization(UserRole.ADMIN)
  @Get('admin-dashboard-stats')
  @HttpCode(HttpStatus.OK)
  public async getAdminDashboardStats() {
    return await this.statisticsService.getAdminDashboardStats();
  }

  @Authorization(UserRole.ADMIN)
  @Delete('delete-room')
  @HttpCode(HttpStatus.OK)
  public async deleteRoom(
    @Query('roomId') roomId: string,
    @Query('type') type: GameMode
  ) {
    return await this.statisticsService.deleteRoom(roomId, type);
  }
}
