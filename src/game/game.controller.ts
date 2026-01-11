import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { GameMode, UserRole } from 'prisma/generated/enums';

import { Authorization } from '@/auth/decorators/auth.decorator';
import { MulterFile } from '@/libs/common/yandex-storage/interfaces/multer-file.interface';

import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameService } from './game.service';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Authorization(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(@Body() dto: CreateGameDto) {
    return this.gameService.createGame(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  public async findAllVisibleGame() {
    return this.gameService.findAllVisibleGame();
  }

  @Authorization(UserRole.ADMIN)
  @Get('full')
  @HttpCode(HttpStatus.OK)
  public async findAllGame() {
    return this.gameService.findAllGame();
  }

  @Authorization()
  @Get('mode/:gameMode')
  @HttpCode(HttpStatus.OK)
  public async findByGameMode(@Param('gameMode') gameMode: GameMode) {
    return this.gameService.findByGameMode(gameMode);
  }

  @Authorization(UserRole.ADMIN)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  public async findGameById(@Param('id') id: string) {
    return this.gameService.findGameById(id);
  }

  @Authorization(UserRole.ADMIN)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  public async updateGame(@Param('id') id: string, @Body() dto: UpdateGameDto) {
    return this.gameService.updateGame(id, dto);
  }

  @Authorization(UserRole.ADMIN)
  @Patch(':id/toggle-visibility')
  @HttpCode(HttpStatus.OK)
  public async toggleVisibility(@Param('id') id: string) {
    return this.gameService.toggleVisibility(id);
  }

  @Authorization(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  public async deleteGame(@Param('id') id: string): Promise<void> {
    return this.gameService.deleteGame(id);
  }

  @Authorization(UserRole.ADMIN)
  @Patch('photo/upload/:gameId')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('photo'))
  public async uploadGamePhoto(
    @Param('gameId') gameId: string,
    @UploadedFile() file: MulterFile
  ) {
    return this.gameService.uploadGamePhoto(gameId, file);
  }

  // @Authorization()
  @Get('photo/:filename')
  @HttpCode(HttpStatus.OK)
  public async getGamePhoto(
    @Param('filename') filename: string,
    @Res() res: Response
  ): Promise<void> {
    return this.gameService.getGamePhoto(filename, res);
  }
}
