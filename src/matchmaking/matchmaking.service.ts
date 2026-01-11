import { Injectable } from '@nestjs/common';
import { GameMode, RoomPrivacy } from 'prisma/generated/enums';

import { BattleRoyalRoomService } from '@/battle-royal-room/battle-royal-room.service';
import { GameService } from '@/game/game.service';
import { MatchmakingRedisService } from '@/redis/matchmaking-redis.service';
import { SocketSessionService } from '@/redis/socket-session.service';
import { WebSocketServerTypes } from '@/redis/types/web-sockets.types';
import { RoomService } from '@/room/room.service';

import { ReadyDto } from './dto/ready.dto';
import { SearchDto } from './dto/search.dto';
import { ParsedPlayer } from './types/parsed-player.types';
import { ParsedReady } from './types/parsed-ready.types';

@Injectable()
export class MatchmakingService {
  private brTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly roomService: RoomService,
    private readonly battleRoyalRoomService: BattleRoyalRoomService,
    private readonly matchmakingRedis: MatchmakingRedisService,
    private readonly socketSessionService: SocketSessionService,
    private readonly gameService: GameService
  ) {}

  async searchMatch(userId: string, dto: SearchDto) {
    try {
      const isAlreadyInQueue = await this.matchmakingRedis.findUserInQueue(
        dto.gameId,
        userId
      );

      if (isAlreadyInQueue) {
        await this.socketSessionService.sendToUser(
          userId,
          'matchmaking_status',
          {
            status: 'already_searching',
            gameId: dto.gameId,
          },
          WebSocketServerTypes.MATCHMAKING
        );
        return { status: 'already_searching' };
      }

      const game = await this.gameService.findGameById(dto.gameId);
      if (!game) {
        return { status: 'error', message: 'Game not found' };
      }

      if (game.gameMode === GameMode.BATTLE_ROYAL) {
        return await this.searchBattleRoyalMatch(userId, dto);
      } else {
        return await this.searchStandardMatch(userId, dto);
      }
    } catch (error) {
      console.error('Error in searchMatch:', error);
      try {
        await this.matchmakingRedis.removeFromQueue(dto.gameId, userId);
      } catch (removeError) {
        console.error('Failed to remove user from queue:', removeError);
      }
      return { status: 'error', message: 'Internal server error' };
    }
  }

  private async searchStandardMatch(userId: string, dto: SearchDto) {
    const opponent = await this.matchmakingRedis.popFromQueue(dto.gameId);

    if (!opponent) {
      const playerData: ParsedPlayer = {
        userId,
        rating: dto.rating,
        ships: dto.ships || [],
      };

      await this.matchmakingRedis.addToQueue(dto.gameId, playerData);

      await this.socketSessionService.sendToUser(
        userId,
        'matchmaking_status',
        {
          status: 'searching',
          gameId: dto.gameId,
        },
        WebSocketServerTypes.MATCHMAKING
      );

      return { status: 'searching' };
    }

    const diff = Math.abs(dto.rating - opponent.rating);
    const allowed = diff <= 1000;

    if (!allowed) {
      await this.matchmakingRedis.returnToQueue(dto.gameId, opponent);
      const playerData: ParsedPlayer = {
        userId,
        rating: dto.rating,
        ships: dto.ships || [],
      };
      await this.matchmakingRedis.addToQueue(dto.gameId, playerData);
      return { status: 'searching' };
    }

    const room = await this.roomService.createRoom(
      dto.gameId,
      userId,
      RoomPrivacy.PUBLIC,
      dto.ships || []
    );
    await this.roomService.joinRoom(room.id, opponent.userId, opponent.ships);

    const [userSent, opponentSent] = await Promise.allSettled([
      this.socketSessionService.sendToUser(
        userId,
        'match_found',
        {
          roomId: room.id,
        },
        WebSocketServerTypes.MATCHMAKING
      ),
      this.socketSessionService.sendToUser(
        opponent.userId,
        'match_found',
        {
          roomId: room.id,
        },
        WebSocketServerTypes.MATCHMAKING
      ),
    ]);

    if (userSent.status === 'rejected' || opponentSent.status === 'rejected') {
      await this.matchmakingRedis.returnToQueue(dto.gameId, opponent);
      const playerData: ParsedPlayer = {
        userId,
        rating: dto.rating,
        ships: dto.ships || [],
      };
      await this.matchmakingRedis.addToQueue(dto.gameId, playerData);
      console.error('Failed to notify players about match, returned to queue');
      return { status: 'searching' };
    }

    return {
      status: 'matched',
      roomId: room.id,
      opponentId: opponent.userId,
    };
  }

  private async searchBattleRoyalMatch(userId: string, dto: SearchDto) {
    const BATTLE_ROYAL_MAX_PLAYERS = 4;
    const BATTLE_ROYAL_MIN_PLAYERS = 2;

    const playerData: ParsedPlayer = {
      userId,
      rating: dto.rating,
      ships: dto.ships || [],
    };

    await this.matchmakingRedis.addToQueue(dto.gameId, playerData);
    const queueSize = await this.matchmakingRedis.getQueueSize(dto.gameId);

    if (
      queueSize >= BATTLE_ROYAL_MIN_PLAYERS &&
      !this.brTimers.has(dto.gameId)
    ) {
      const timer = setTimeout(
        () => this.handleBattleRoyalTimer(dto.gameId),
        30000
      );
      this.brTimers.set(dto.gameId, timer);
    }

    if (queueSize >= BATTLE_ROYAL_MAX_PLAYERS) {
      this.clearBattleRoyalTimer(dto.gameId);

      const players: ParsedPlayer[] = [];
      for (let i = 0; i < BATTLE_ROYAL_MAX_PLAYERS; i++) {
        const p = await this.matchmakingRedis.popFromQueue(dto.gameId);
        if (p) players.push(p);
      }

      if (players.length === BATTLE_ROYAL_MAX_PLAYERS) {
        await this.startBattleRoyalRoom(dto.gameId, players);
        return { status: 'matched', totalPlayers: players.length };
      } else {
        for (const p of players)
          await this.matchmakingRedis.returnToQueue(dto.gameId, p);
      }
    }

    await this.socketSessionService.sendToUser(
      userId,
      'matchmaking_status',
      {
        status: 'searching',
        gameId: dto.gameId,
        playersInQueue: queueSize,
        playersRequired: BATTLE_ROYAL_MAX_PLAYERS,
      },
      WebSocketServerTypes.MATCHMAKING
    );

    return { status: 'searching', playersInQueue: queueSize };
  }

  private handleBattleRoyalTimer(gameId: string): void {
    this.forceStartBattleRoyal(gameId).catch(error => {
      console.error('Error in forceStartBattleRoyal:', error);
    });
  }

  private async forceStartBattleRoyal(gameId: string) {
    this.brTimers.delete(gameId);

    const queueSize = await this.matchmakingRedis.getQueueSize(gameId);

    if (queueSize >= 2) {
      const players: ParsedPlayer[] = [];
      for (let i = 0; i < 4; i++) {
        const p = await this.matchmakingRedis.popFromQueue(gameId);
        if (p) players.push(p);
      }

      if (players.length >= 2) {
        await this.startBattleRoyalRoom(gameId, players);
      } else {
        for (const p of players) {
          await this.matchmakingRedis.returnToQueue(gameId, p);
        }
      }
    }
  }

  private async startBattleRoyalRoom(gameId: string, players: ParsedPlayer[]) {
    const room = await this.battleRoyalRoomService.createBattleRoyalRoom(
      gameId,
      players[0].userId,
      RoomPrivacy.PUBLIC
    );

    const joinPromises = players
      .slice(1)
      .map(p =>
        this.battleRoyalRoomService.joinBattleRoyalRoom(room.id, p.userId)
      );
    await Promise.all(joinPromises);

    await this.battleRoyalRoomService.generateBattleRoyalRoomUpgrade(room.id);

    const notificationPromises = players.map(player =>
      this.socketSessionService.sendToUser(
        player.userId,
        'match_found_battle_royal',
        {
          roomId: room.id,
          totalPlayers: players.length,
        },
        WebSocketServerTypes.MATCHMAKING
      )
    );

    await Promise.allSettled(notificationPromises);

    this.clearBattleRoyalTimer(gameId);
  }

  private clearBattleRoyalTimer(gameId: string) {
    if (this.brTimers.has(gameId)) {
      clearTimeout(this.brTimers.get(gameId));
      this.brTimers.delete(gameId);
    }
  }

  // async searchMatch(userId: string, dto: SearchDto) {
  //   try {
  //     const isAlreadyInQueue = await this.matchmakingRedis.findUserInQueue(
  //       dto.gameId,
  //       userId
  //     );

  //     if (isAlreadyInQueue) {
  //       await this.socketSessionService.sendToUser(
  //         userId,
  //         'matchmaking_status',
  //         {
  //           status: 'already_searching',
  //           gameId: dto.gameId,
  //         },
  //         WebSocketServerTypes.MATCHMAKING
  //       );
  //       return { status: 'already_searching' };
  //     }

  //     const opponent = await this.matchmakingRedis.popFromQueue(dto.gameId);

  //     if (!opponent) {
  //       const playerData: ParsedPlayer = {
  //         userId,
  //         rating: dto.rating,
  //         ships: dto.ships || [],
  //       };

  //       await this.matchmakingRedis.addToQueue(dto.gameId, playerData);

  //       await this.socketSessionService.sendToUser(
  //         userId,
  //         'matchmaking_status',
  //         {
  //           status: 'searching',
  //           gameId: dto.gameId,
  //         },
  //         WebSocketServerTypes.MATCHMAKING
  //       );

  //       return { status: 'searching' };
  //     }

  //     const diff = Math.abs(dto.rating - opponent.rating);
  //     const allowed = diff <= 1000;

  //     if (!allowed) {
  //       await this.matchmakingRedis.returnToQueue(dto.gameId, opponent);
  //       await this.matchmakingRedis.addToQueue(dto.gameId, {
  //         userId,
  //         rating: dto.rating,
  //         ships: dto.ships || [],
  //       });
  //       return { status: 'searching' };
  //     }

  //     const game = await this.gameService.findGameById(dto.gameId);

  //     if (!game) {
  //       await this.matchmakingRedis.returnToQueue(dto.gameId, opponent);
  //       await this.matchmakingRedis.addToQueue(dto.gameId, {
  //         userId,
  //         rating: dto.rating,
  //         ships: dto.ships || [],
  //       });
  //       return { status: 'searching' };
  //     }

  //     let roomId = '';
  //     let gameFoundEvent = '';

  //     if (game.gameMode === GameMode.BATTLE_ROYAL) {
  //       const room = await this.battleRoyalRoomService.createBattleRoyalRoom(
  //         dto.gameId,
  //         userId,
  //         RoomPrivacy.PUBLIC
  //       );
  //       await this.battleRoyalRoomService.joinBattleRoyalRoom(
  //         room.id,
  //         opponent.userId
  //       );
  //       await this.battleRoyalRoomService.generateBattleRoyalRoomUpgrade(
  //         room.id
  //       );
  //       roomId = room.id;
  //       gameFoundEvent = 'match_found_battle_royal';
  //     } else {
  //       const room = await this.roomService.createRoom(
  //         dto.gameId,
  //         userId,
  //         RoomPrivacy.PUBLIC,
  //         dto.ships || []
  //       );
  //       await this.roomService.joinRoom(
  //         room.id,
  //         opponent.userId,
  //         opponent.ships
  //       );
  //       roomId = room.id;
  //       gameFoundEvent = 'match_found';
  //     }

  //     const [userSent, opponentSent] = await Promise.allSettled([
  //       this.socketSessionService.sendToUser(
  //         userId,
  //         gameFoundEvent,
  //         {
  //           roomId: roomId,
  //         },
  //         WebSocketServerTypes.MATCHMAKING
  //       ),
  //       this.socketSessionService.sendToUser(
  //         opponent.userId,
  //         gameFoundEvent,
  //         {
  //           roomId: roomId,
  //         },
  //         WebSocketServerTypes.MATCHMAKING
  //       ),
  //     ]);

  //     if (
  //       userSent.status === 'rejected' ||
  //       opponentSent.status === 'rejected'
  //     ) {
  //       await this.matchmakingRedis.returnToQueue(dto.gameId, opponent);
  //       await this.matchmakingRedis.addToQueue(dto.gameId, {
  //         userId,
  //         rating: dto.rating,
  //         ships: dto.ships || [],
  //       });
  //       console.error(
  //         'Failed to notify players about match, returned to queue'
  //       );
  //       return { status: 'searching' };
  //     }

  //     return {
  //       status: 'matched',
  //       roomId: roomId,
  //       opponentId: opponent.userId,
  //     };
  //   } catch (error) {
  //     console.error('Error in searchMatch:', error);
  //     try {
  //       await this.matchmakingRedis.removeFromQueue(dto.gameId, userId);
  //     } catch (removeError) {
  //       console.error('Failed to remove user from queue:', removeError);
  //     }
  //   }
  // }

  async cancelSearch(gameId: string, userId: string) {
    try {
      const removed = await this.matchmakingRedis.removeFromQueue(
        gameId,
        userId
      );

      if (removed) {
        const size = await this.matchmakingRedis.getQueueSize(gameId);
        if (size < 2) {
          this.clearBattleRoyalTimer(gameId);
        }
        await this.socketSessionService.sendToUser(
          userId,
          'matchmaking_cancelled',
          { gameId },
          WebSocketServerTypes.MATCHMAKING
        );
      }

      return { status: 'cancelled' };
    } catch (error) {
      console.error('Error in cancelSearch:', error);
      throw error;
    }
  }

  async playerReady(userId: string, dto: ReadyDto) {
    const readyPlayer: ParsedReady = {
      userId: userId,
      ships: dto.ships,
    };

    const count = await this.matchmakingRedis.setPlayerReady(
      dto.roomId,
      readyPlayer
    );

    if (count === 2) {
      const playersData = await this.matchmakingRedis.getReadyPlayers(
        dto.roomId
      );

      const currentPlayer = playersData.find(p => p.userId === userId);
      const opponent = playersData.find(p => p.userId !== userId);

      if (!currentPlayer || !opponent) {
        throw new Error('Player data not found in ready room');
      }

      const game = await this.gameService.findGameById(dto.gameId);
      let roomId = '';

      if (game.gameMode === GameMode.BATTLE_ROYAL) {
        const room = await this.battleRoyalRoomService.createBattleRoyalRoom(
          dto.gameId,
          userId,
          RoomPrivacy.PRIVATE
        );

        await this.battleRoyalRoomService.joinBattleRoyalRoom(
          room.id,
          opponent.userId
        );
        await this.battleRoyalRoomService.generateBattleRoyalRoomUpgrade(
          room.id
        );

        roomId = room.id;
      } else {
        const room = await this.roomService.createRoom(
          dto.gameId,
          userId,
          RoomPrivacy.PRIVATE,
          currentPlayer.ships
        );
        await this.roomService.joinRoom(
          room.id,
          opponent.userId,
          opponent.ships
        );
        roomId = room.id;
      }

      await this.matchmakingRedis.clearReadyRoom(dto.roomId);

      await Promise.allSettled([
        this.socketSessionService.sendToUser(
          userId,
          'match_ready_start',
          {
            roomId: roomId,
          },
          WebSocketServerTypes.MATCHMAKING
        ),
        this.socketSessionService.sendToUser(
          opponent.userId,
          'match_ready_start',
          {
            roomId: roomId,
          },
          WebSocketServerTypes.MATCHMAKING
        ),
      ]);

      return {
        status: 'start',
        roomId: roomId,
        message: 'Game started successfully',
      };
    }

    await this.socketSessionService.sendToUser(
      dto.friendId,
      'player_ready_notification',
      {},
      WebSocketServerTypes.MATCHMAKING
    );

    return {
      status: 'waiting',
      readyCount: count,
      message: 'Waiting for opponent to ready up',
    };
  }

  async cancelReady(userId: string, dto: ReadyDto) {
    const remainingCount = await this.matchmakingRedis.removePlayerReady(
      dto.roomId,
      userId
    );

    await this.socketSessionService.sendToUser(
      dto.friendId,
      'player_ready_cancelled',
      {},
      WebSocketServerTypes.MATCHMAKING
    );

    return {
      status: 'cancelled',
      remainingPlayers: remainingCount,
    };
  }

  async handleUserDisconnect(userId: string) {
    try {
      const pattern = 'matchmaking:queue:*';

      let cursor = '0';
      const removedFromGames: string[] = [];

      do {
        const redisClient = (this.matchmakingRedis as any).redisClient;

        const scanResult = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });

        cursor = scanResult.cursor;
        const keys = scanResult.keys;

        for (const key of keys) {
          const gameId = key.replace('matchmaking:queue:', '');

          if (typeof gameId !== 'string' || gameId.length === 0) {
            continue;
          }

          const removed = await this.matchmakingRedis.removeFromQueue(
            gameId,
            userId
          );

          if (removed) {
            removedFromGames.push(gameId);
          }
        }
      } while (cursor !== '0');

      return { removedFromGames };
    } catch (error) {
      console.error('Error in handleUserDisconnect:', error);
      return { removedFromGames: [] };
    }
  }
}
