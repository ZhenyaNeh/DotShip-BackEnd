import { BadRequestException, Injectable } from '@nestjs/common';
import { Move, Ship } from 'prisma/generated/client';
import { MoveResult, RoomPrivacy } from 'prisma/generated/enums';

import {
  getSurroundingCells,
  shipFireHit,
} from '@/libs/common/utils/game.util';
import { ShipType } from '@/matchmaking/types/ship.types';
import { PrismaService } from '@/prisma/prisma.service';
import { UserService } from '@/user/user.service';

import { GameStateResponse } from './types/initial-game-response.types';

@Injectable()
export class RoomService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService
  ) {}

  async createRoom(
    gameId: string,
    creatorId: string,
    privacy: RoomPrivacy,
    ships: ShipType[] = []
  ) {
    try {
      const room = this.prismaService.$transaction(async prisma => {
        await this.userService.findById(creatorId);

        const createdRoom = await prisma.room.create({
          data: {
            gameId,
            playerTurn: creatorId,
            privacy,
            creatorId,
          },
        });

        const shipsData = ships.map(ship => ({
          shipId: ship.id,
          x: ship.x,
          y: ship.y,
          w: ship.w,
          h: ship.h,
          health: ship.health,
          maxHealth: ship.health,
        }));

        await prisma.player.create({
          data: {
            userId: creatorId,
            roomId: createdRoom.id,
            ships: {
              create: shipsData,
            },
          },
        });

        return createdRoom;
      });

      return room;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  async joinRoom(roomId: string, userId: string, ships: ShipType[] = []) {
    await this.userService.findById(userId);
    await this.findRoomById(roomId);

    const playersCount = await this.prismaService.player.count({
      where: { roomId },
    });

    if (playersCount >= 2) {
      throw new Error('Room is full');
    }

    const existingPlayer = await this.prismaService.player.findFirst({
      where: { roomId, userId },
    });

    if (existingPlayer) {
      throw new Error('Player already in room');
    }

    const shipsData = ships.map(ship => ({
      shipId: ship.id,
      x: ship.x,
      y: ship.y,
      w: ship.w,
      h: ship.h,
      health: ship.health,
      maxHealth: ship.health,
    }));

    const createdPlayer = await this.prismaService.player.create({
      data: {
        userId: userId,
        roomId: roomId,
        ships: {
          create: shipsData,
        },
      },
    });

    return createdPlayer;
  }

  async findRoomById(roomId: string) {
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    return room;
  }

  async findPlayerById(playerId: string) {
    const player = await this.prismaService.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new Error('Player not found');
    }

    return player;
  }

  async getPlayersInRoom(roomId: string, userId: string) {
    const players = await this.prismaService.player.findMany({
      where: {
        roomId: roomId,
      },
      include: {
        user: true,
        moves: true,
        ships: true,
      },
    });

    if (!players) {
      throw new Error(`Failed to fetch players for room ${roomId}`);
    }

    if (players.length < 2) {
      throw new Error('There must be 2 players in the room.');
    }

    const userPlayer = players.find(player => player.userId === userId);
    const opponentPlayer = players.find(player => player.userId !== userId);

    if (!userPlayer) {
      throw new Error('User not found in this room');
    }

    if (!opponentPlayer) {
      throw new Error('Opponent not found in this room');
    }

    return { user: userPlayer, opponent: opponentPlayer };
  }

  async addPlayerMove(
    playerId: string,
    x: number,
    y: number,
    result: MoveResult
  ) {
    const move = await this.prismaService.move.create({
      data: {
        x: x,
        y: y,
        result: result,
        playerId: playerId,
      },
    });

    await this.prismaService.player.update({
      where: {
        id: playerId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return move;
  }

  async addMoves(
    playerId: string,
    moves: Partial<Pick<Move, 'x' | 'y' | 'result'>>[]
  ) {
    const movesData = moves.map(({ x, y, result }) => ({
      x,
      y,
      result,
      playerId,
    }));

    await this.prismaService.move.createMany({
      data: movesData,
      skipDuplicates: true,
    });

    const movesWithIds = await this.prismaService.move.findMany({
      where: {
        playerId,
      },
    });

    return movesWithIds;
  }

  async getShipById(id: string) {
    return await this.prismaService.ship.findFirst({
      where: {
        id: id,
      },
    });
  }

  async getPlayerShipsById(playerId: string) {
    return await this.prismaService.ship.findMany({
      where: {
        playerId,
      },
    });
  }

  async addRocketMoves(
    playerId: string,
    moves: Partial<Pick<Move, 'x' | 'y' | 'result'>>[],
    opponentShips: Ship[]
  ) {
    const movesHitData = moves.filter(move => move.result === MoveResult.HIT);

    const movesData = moves
      .filter(move => move.result === MoveResult.MISS)
      .map(({ x, y, result }) => ({
        x,
        y,
        result,
        playerId,
      }));

    for (const hit of movesHitData) {
      const hitShip = opponentShips.find(ship =>
        shipFireHit(ship, hit.x, hit.y)
      );

      const finedHitShip = await this.getShipById(hitShip.id);

      if (hitShip.health === 0) {
        continue;
      }

      const updatedShip = await this.hitShip(finedHitShip);

      if (updatedShip.health === 0) {
        movesData.push({
          x: hit.x,
          y: hit.y,
          result: MoveResult.SUNK,
          playerId,
        });

        const surroundingCells = getSurroundingCells(updatedShip);

        const surroundingMoves = surroundingCells.map(cell => ({
          x: cell.x,
          y: cell.y,
          result: MoveResult.MISS,
          playerId,
        }));
        movesData.push(...surroundingMoves);
        continue;
      }

      movesData.push({
        x: hit.x,
        y: hit.y,
        result: MoveResult.HIT,
        playerId,
      });
    }

    await this.prismaService.move.createMany({
      data: movesData,
      skipDuplicates: true,
    });

    const movesWithIds = await this.prismaService.move.findMany({
      where: {
        playerId,
      },
    });

    return movesWithIds;
  }

  async hitShip(ship: Ship) {
    if (ship.health <= 0) {
      throw new BadRequestException('The ship has already been destroyed');
    }

    const updatedShip = await this.prismaService.ship.update({
      where: {
        id: ship.id,
      },
      data: {
        health: ship.health - 1,
        updatedAt: new Date(),
      },
    });

    return updatedShip;
  }

  async checkPlayerTurn(roomId: string, userId: string) {
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
      include: {
        players: {
          include: { user: true },
        },
      },
    });

    if (!room) {
      throw new BadRequestException('Room not found');
    }

    if (room.playerTurn !== userId) {
      throw new BadRequestException("It's not your turn");
    }
  }

  async checkGameOver(roomId: string) {
    const gameResult = await this.prismaService.gameResult.findFirst({
      where: { roomId: roomId },
    });

    return !!gameResult;
  }

  async changePlayerTurn(roomId: string, opponentId: string) {
    const updatedRoom = await this.prismaService.room.update({
      where: { id: roomId },
      data: {
        playerTurn: opponentId,
        updatedAt: new Date(),
      },
    });

    return updatedRoom;
  }

  async updatePlayersAfterStorm(
    userPlayerId: string,
    opponentPlayerId: string,
    resultUserShips: Ship[],
    resultOpponentMove: Move[]
  ) {
    await this.prismaService.$transaction(async prisma => {
      await prisma.ship.deleteMany({
        where: { playerId: userPlayerId },
      });

      await prisma.ship.createMany({
        data: resultUserShips.map(ship => ({
          ...ship,
          playerId: userPlayerId,
        })),
      });

      await prisma.move.deleteMany({
        where: { playerId: opponentPlayerId },
      });

      await prisma.move.createMany({
        data: resultOpponentMove.map(move => ({
          ...move,
          playerId: opponentPlayerId,
        })),
      });
    });
  }

  async updateGameResults(roomId: string, userId: string) {
    const { user, opponent } = await this.getPlayersInRoom(roomId, userId);

    const userLiveShips = user.ships.some(ship => ship.health > 0);
    const opponentLiveShips = opponent.ships.some(ship => ship.health > 0);

    if (userLiveShips && opponentLiveShips) {
      return false;
    }

    const alreadyHasGameOverResults = await this.checkGameOver(roomId);
    if (alreadyHasGameOverResults) {
      return true;
    }

    const userRatingChange = 30;
    const opponentRatingChange =
      30 -
      user.ships.reduce((acc, ship) => acc + ship.maxHealth - ship.health, 0);

    await this.prismaService.$transaction(async prisma => {
      const gameResult = await prisma.gameResult.create({
        data: {
          roomId: roomId,
          winnerId: userId,
        },
        include: {
          room: true,
        },
      });

      const userRatingHistory = await prisma.ratingHistory.create({
        data: {
          userId: user.user.id,
          oldRating: user.user.rating,
          newRating: user.user.rating + userRatingChange,
          ratingChange: userRatingChange,
          gameResultId: gameResult.id,
        },
      });

      const opponentRatingHistory = await prisma.ratingHistory.create({
        data: {
          userId: opponent.user.id,
          oldRating: opponent.user.rating,
          newRating: Math.max(0, opponent.user.rating - opponentRatingChange),
          ratingChange: opponentRatingChange,
          gameResultId: gameResult.id,
        },
      });

      await prisma.user.update({
        where: {
          id: user.user.id,
        },
        data: {
          rating: userRatingHistory.newRating,
        },
      });

      await prisma.user.update({
        where: {
          id: opponent.user.id,
        },
        data: {
          rating: opponentRatingHistory.newRating,
        },
      });
    });

    return true;
  }

  async getInitialGameState(
    roomId: string,
    userId: string
  ): Promise<GameStateResponse> {
    const isGameOver = await this.updateGameResults(roomId, userId);
    const room = await this.prismaService.room.findUnique({
      where: { id: roomId },
      include: {
        players: {
          include: {
            user: true,
            ships: true,
            moves: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        gameResults: {
          include: {
            ratingHistory: true,
          },
        },
        game: true,
      },
    });

    if (!room) {
      throw new BadRequestException('Room not found');
    }

    const { user: userPlayer, opponent: opponentPlayer } =
      await this.getPlayersInRoom(roomId, userId);

    const userShips = userPlayer.ships.map(ship => ({
      id: ship.shipId,
      x: ship.x,
      y: ship.y,
      w: ship.w,
      h: ship.h,
      health: ship.health,
    }));

    const opponentShips = opponentPlayer.ships
      .filter(ship => (!isGameOver ? ship.health === 0 : true))
      .map(ship => ({
        id: ship.shipId,
        x: ship.x,
        y: ship.y,
        w: ship.w,
        h: ship.h,
        health: ship.health,
      }));

    const gameResult = room.gameResults?.[0];
    const userRatingHistory = gameResult?.ratingHistory?.find(
      his => his.userId === userPlayer.user.id
    );
    const opponentRatingHistory = gameResult?.ratingHistory?.find(
      his => his.userId === opponentPlayer.user.id
    );

    const response: GameStateResponse = {
      player_user: {
        user: userPlayer.user,
        ships: userShips,
        moves: userPlayer.moves,
        ratingHistory: userRatingHistory,
      },
      player_opponent: {
        user: opponentPlayer.user,
        ships: opponentShips,
        moves: opponentPlayer.moves,
        ratingHistory: opponentRatingHistory,
      },
      playerTurn: room.playerTurn,
      winner_id: gameResult?.winnerId,
      room: {
        id: room.id,
        privacy: room.privacy,
        gameMode: room.game.gameMode,
      },
    };

    return response;
  }
}
