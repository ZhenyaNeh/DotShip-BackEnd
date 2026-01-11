import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { GameMode } from 'prisma/generated/enums';
import { GameCreateInput, GameUpdateInput } from 'prisma/generated/models';

import { MulterFile } from '@/libs/common/yandex-storage/interfaces/multer-file.interface';
import { YandexDiskService } from '@/libs/common/yandex-storage/yandex-storage.service';
import { NotificationService } from '@/notification/notification.service';

import { PrismaService } from '../prisma/prisma.service';

import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';

@Injectable()
export class GameService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly yandexDiskService: YandexDiskService,
    private readonly notificationService: NotificationService
  ) {}

  async createGame(dto: CreateGameDto) {
    if (dto.minPlayers > dto.maxPlayers) {
      throw new BadRequestException(
        'minPlayers cannot be greater than maxPlayers'
      );
    }

    const existingGame = await this.prismaService.game.findFirst({
      where: { displayName: dto.displayName },
    });

    if (existingGame) {
      throw new BadRequestException('Game with this name already exists');
    }

    const gameData: GameCreateInput = {
      displayName: dto.displayName,
      picture: dto.picture,
      minPlayers: dto.minPlayers,
      maxPlayers: dto.maxPlayers,
      description: dto.description,
      isVisible: dto.isVisible ?? true,
      gameMode: dto.gameMode,
      difficulty: dto.difficulty,
      estimatedTime: dto.estimatedTime,
    };

    if (dto.rules && dto.rules.length > 0) {
      gameData.rules = {
        create: dto.rules.map((rule, index) => ({
          title: rule.title,
          description: rule.description,
          order: rule.order || index + 1,
        })),
      };
    }

    const game = await this.prismaService.game.create({
      data: gameData,
      include: {
        rules: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return game;
  }

  async findAllVisibleGame() {
    const games = await this.prismaService.game.findMany({
      where: {
        isVisible: true,
      },
      include: {
        rules: {
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return games;
  }

  async findAllGame() {
    const games = await this.prismaService.game.findMany({
      include: {
        rules: {
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return games;
  }

  async findGameById(id: string) {
    const game = await this.prismaService.game.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }

    return game;
  }

  async findByGameMode(gameMode: GameMode) {
    return this.prismaService.game.findMany({
      where: {
        gameMode,
        isVisible: true,
      },
      include: {
        rules: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  async updateGame(id: string, dto: UpdateGameDto) {
    await this.findGameById(id);

    if (dto.minPlayers && dto.maxPlayers && dto.minPlayers > dto.maxPlayers) {
      throw new BadRequestException(
        'minPlayers cannot be greater than maxPlayers'
      );
    }

    const updateData: GameUpdateInput = {
      displayName: dto.displayName,
      picture: dto.picture,
      minPlayers: dto.minPlayers,
      maxPlayers: dto.maxPlayers,
      description: dto.description,
      isVisible: dto.isVisible,
      gameMode: dto.gameMode,
      difficulty: dto.difficulty,
      estimatedTime: dto.estimatedTime,
    };

    if (dto.rules) {
      await this.prismaService.rule.deleteMany({
        where: { gameId: id },
      });

      updateData.rules = {
        create: dto.rules.map((rule, index) => ({
          title: rule.title,
          description: rule.description,
          order: rule.order || index + 1,
        })),
      };
    }

    const updatedGame = await this.prismaService.game.update({
      where: { id },
      data: updateData,
      include: {
        rules: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    this.notificationService.notifyPlayers('game_updated', {});

    return updatedGame;
  }

  async updateGameRules(
    id: string,
    rules: Array<{ title: string; description: string; order: number }>
  ) {
    await this.findGameById(id);

    await this.prismaService.rule.deleteMany({
      where: { gameId: id },
    });

    const createdRules = await this.prismaService.$transaction(
      rules.map(rule =>
        this.prismaService.rule.create({
          data: {
            title: rule.title,
            description: rule.description,
            order: rule.order,
            gameId: id,
          },
        })
      )
    );

    return createdRules;
  }

  async toggleVisibility(id: string) {
    const game = await this.findGameById(id);

    const updatedGame = await this.prismaService.game.update({
      where: { id },
      data: {
        isVisible: !game.isVisible,
      },
      include: {
        rules: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return updatedGame;
  }

  async deleteGame(id: string) {
    const game = await this.findGameById(id);

    await this.prismaService.rule.deleteMany({
      where: { gameId: game.id },
    });

    await this.prismaService.game.delete({
      where: { id: game.id },
    });
  }

  async getGameRules(id: string) {
    const game = await this.prismaService.game.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }

    return game.rules;
  }

  async addRuleToGame(
    id: string,
    ruleData: { title: string; description: string; order?: number }
  ) {
    const game = await this.prismaService.game.findUnique({
      where: { id },
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }

    const lastRule = await this.prismaService.rule.findFirst({
      where: { gameId: id },
      orderBy: { order: 'desc' },
    });

    const order = ruleData.order || (lastRule?.order || 0) + 1;

    const rule = await this.prismaService.rule.create({
      data: {
        title: ruleData.title,
        description: ruleData.description,
        order,
        gameId: id,
      },
    });

    return rule;
  }

  async uploadGamePhoto(gameId: string, file: MulterFile) {
    const game = await this.findGameById(gameId);

    const uploadPhoto = await this.yandexDiskService.uploadUserAvatar(
      game.id,
      file,
      `game`
    );

    const updatedGame = await this.prismaService.game.update({
      where: {
        id: game.id,
      },
      data: {
        picture: uploadPhoto.url,
      },
      include: {
        rules: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return updatedGame;
  }

  getGamePhoto(filename: string, res: Response) {
    return this.yandexDiskService.streamFile(filename, res, 'game');
  }
}
