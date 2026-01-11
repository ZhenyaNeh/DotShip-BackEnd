import { Injectable } from '@nestjs/common';
import {
  BattleRoyalPlayer,
  BattleRoyalRoom,
  BattleRoyalUpgradeSlot,
} from 'prisma/generated/client';
import {
  BattleRoyalRoomStatus,
  BattleRoyalUpgradeType,
  RoomPrivacy,
} from 'prisma/generated/enums';
import { TransactionClient } from 'prisma/generated/internal/prismaNamespace';

import { BattleRoyalGameData } from '@/battle-royal-room/types/battle-royal-initial.types';
import { BattleRoyalBonusDto } from '@/game-session/dto/battle-royal-bonus.dto';
import {
  calculateSafeZone,
  generateInitialPositions,
  generatePlayerPosition,
  generateUpgrades,
  generateVisibleCells,
} from '@/libs/common/utils/battle-royal.util';
import { PrismaService } from '@/prisma/prisma.service';
import { UserService } from '@/user/user.service';

import { GameResultSummary } from './types/battle-royal-game-results.types';

@Injectable()
export class BattleRoyalRoomService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService
  ) {}

  async createBattleRoyalRoom(
    gameId: string,
    creatorId: string,
    privacy: RoomPrivacy
  ) {
    try {
      const room = await this.prismaService.$transaction(async prisma => {
        await this.userService.findById(creatorId);

        const initialPosition = generateInitialPositions();

        const createdRoom = await prisma.battleRoyalRoom.create({
          data: {
            gameId,
            playerTurn: creatorId,
            privacy,
            creatorId,
            fieldSize: 20,
            status: 'WAITING',
            turnNumber: 0,
            safeZoneRadius: 20,
            nextShrinkTurn: 8,
          },
        });

        const player = await prisma.battleRoyalPlayer.create({
          data: {
            userId: creatorId,
            roomId: createdRoom.id,
            x: initialPosition.x,
            y: initialPosition.y,
            lives: 1,
            maxLives: 4,
            movementBoost: 0,
            attackBoost: 0,
            visionRadius: 3,
            kills: 0,
            damageDealt: 0,
            distanceTraveled: 0,
            isAlive: true,
            upgradeSlots: {
              create: [
                { slotIndex: 0, upgradeType: null },
                { slotIndex: 1, upgradeType: null },
                { slotIndex: 2, upgradeType: null },
              ],
            },
          },
        });

        await prisma.battleRoyalRoom.update({
          where: {
            id: createdRoom.id,
          },
          data: {
            playerTurn: player.id,
          },
        });

        const visibleCells = generateVisibleCells(
          player.id,
          initialPosition.x,
          initialPosition.y,
          3
        );

        if (visibleCells.length > 0) {
          await prisma.battleRoyalVisibleCell.createMany({
            data: visibleCells,
          });
        }

        return createdRoom;
      });

      return room;
    } catch (error) {
      console.error('Error creating battle royal room:', error);
      throw error;
    }
  }

  async joinBattleRoyalRoom(roomId: string, userId: string) {
    await this.userService.findById(userId);

    const room = await this.prismaService.battleRoyalRoom.findUnique({
      where: { id: roomId },
      include: {
        players: true,
      },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'WAITING') {
      throw new Error('Room is not waiting for players');
    }

    if (room.players.length >= 2) {
      throw new Error('Room is full (max 2 players)');
    }

    const existingPlayer = room.players.find(p => p.userId === userId);
    if (existingPlayer) {
      throw new Error('Player already in room');
    }

    const existingPositions = room.players.map(p => ({ x: p.x, y: p.y }));
    const initialPosition = generatePlayerPosition(existingPositions);

    const createdPlayer = await this.prismaService.battleRoyalPlayer.create({
      data: {
        userId,
        roomId,
        x: initialPosition.x,
        y: initialPosition.y,
        lives: 1,
        maxLives: 4,
        movementBoost: 0,
        attackBoost: 0,
        visionRadius: 3,
        kills: 0,
        damageDealt: 0,
        distanceTraveled: 0,
        isAlive: true,
        upgradeSlots: {
          create: [
            { slotIndex: 0, upgradeType: null },
            { slotIndex: 1, upgradeType: null },
            { slotIndex: 2, upgradeType: null },
          ],
        },
      },
    });

    const visibleCells = generateVisibleCells(
      createdPlayer.id,
      initialPosition.x,
      initialPosition.y,
      3
    );

    if (visibleCells.length > 0) {
      await this.prismaService.battleRoyalVisibleCell.createMany({
        data: visibleCells,
      });
    }

    return createdPlayer;
  }
  async generateBattleRoyalRoomUpgrade(roomId: string) {
    const room = await this.prismaService.battleRoyalRoom.findUnique({
      where: { id: roomId },
      include: {
        players: true,
        upgrades: true,
      },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    const existingPositions = room.players.map(p => ({ x: p.x, y: p.y }));
    const upgrades = generateUpgrades(existingPositions);

    await this.prismaService.$transaction(async prisma => {
      if (room.upgrades.length === 0) {
        await prisma.battleRoyalUpgrade.createMany({
          data: upgrades.map(upgrade => ({
            roomId,
            x: upgrade.x,
            y: upgrade.y,
            upgradeType: upgrade.upgradeType,
            isCollected: false,
          })),
        });
      }
      if (room.players.length + 1 >= 2) {
        await prisma.battleRoyalRoom.update({
          where: { id: roomId },
          data: { status: 'IN_PROGRESS' },
        });
      }
    });
  }

  async getPlayerInRoom(roomId: string, userId: string) {
    const player = await this.prismaService.battleRoyalPlayer.findFirst({
      where: {
        userId,
        roomId,
        isAlive: true,
      },
      include: {
        room: true,
        visibleCells: true,
        upgradeSlots: true,
      },
    });

    if (!player) {
      throw new Error('The player is not found or is dead.');
    }

    if (!player.room) {
      throw new Error('Room not found');
    }

    return player;
  }

  // async getAllLivePlayersInRoom(roomId: string) {
  //   const players = await this.prismaService.battleRoyalPlayer.findMany({
  //     where: {
  //       roomId,
  //       isAlive: true,
  //     },
  //     include: {
  //       room: true,
  //       user: true,
  //     },
  //   });

  //   if (!players) {
  //     throw new Error('The player is not found or is dead.');
  //   }

  //   return players;
  // }

  async getAllPlayersInRoom(roomId: string) {
    const players = await this.prismaService.battleRoyalPlayer.findMany({
      where: {
        roomId,
      },
      include: {
        room: true,
        user: true,
      },
    });

    if (!players) {
      throw new Error('The player is not found or is dead.');
    }

    return players;
  }

  async checkCellEmpty(roomId: string, playerId: string, x: number, y: number) {
    const occupiedPlayerCell =
      await this.prismaService.battleRoyalPlayer.findFirst({
        where: {
          roomId,
          id: { not: playerId },
          x,
          y,
          isAlive: true,
        },
      });

    if (occupiedPlayerCell) {
      return false;
    }

    const occupiedUpgradeCell =
      await this.prismaService.battleRoyalUpgrade.findFirst({
        where: {
          roomId,
          x,
          y,
          isCollected: false,
        },
      });

    if (occupiedUpgradeCell) {
      return false;
    }

    return true;
  }

  async checkCellBonus(roomId: string, playerId: string, x: number, y: number) {
    const occupiedUpgradeCell =
      await this.prismaService.battleRoyalUpgrade.findFirst({
        where: {
          roomId,
          x,
          y,
          isCollected: false,
        },
      });

    return occupiedUpgradeCell;
  }

  async checkCellPlayer(
    roomId: string,
    playerId: string,
    x: number,
    y: number
  ) {
    const occupiedPlayerCell =
      await this.prismaService.battleRoyalPlayer.findFirst({
        where: {
          roomId,
          id: { not: playerId },
          x,
          y,
          isAlive: true,
        },
      });

    return occupiedPlayerCell;
  }

  async battleRoyalMoveUpdate(player: BattleRoyalPlayer, x: number, y: number) {
    await this.prismaService.$transaction(async tx => {
      const updatedPlayer = await tx.battleRoyalPlayer.update({
        where: { id: player.id },
        data: {
          x,
          y,
          remainingMoves: player.remainingMoves - 1,
          distanceTraveled: player.distanceTraveled + 1,
        },
      });

      const visibleCells = generateVisibleCells(
        updatedPlayer.id,
        x,
        y,
        updatedPlayer.visionRadius
      );

      await tx.battleRoyalVisibleCell.deleteMany({
        where: { playerId: player.id },
      });

      await tx.battleRoyalVisibleCell.createMany({
        data: visibleCells,
        skipDuplicates: true,
      });
    });
  }

  async battleRoyalOpponentHitUpdate(
    attacker: BattleRoyalPlayer,
    target: BattleRoyalPlayer,
    damage: number = 1
  ) {
    const newLives = target.lives - damage;
    const isTargetAlive = newLives > 0;

    const attackerKills = attacker.kills + (isTargetAlive ? 0 : 1);
    const attackerDamageDealt = attacker.damageDealt + damage;

    await this.prismaService.battleRoyalPlayer.update({
      where: { id: target.id },
      data: {
        lives: newLives,
        isAlive: isTargetAlive,
        ...(!isTargetAlive && {
          eliminatedBy: attacker.id,
          eliminationOrder: await this.getNextEliminationOrder(target.roomId),
        }),
      },
    });

    await this.battleRoyalAttackUpdate(
      attacker,
      attackerKills,
      attackerDamageDealt
    );
  }

  async battleRoyalAttackUpdate(
    player: BattleRoyalPlayer,
    kills: number,
    damageDealt: number
  ) {
    const newRemainingAttacks = player.remainingAttacks - 1;
    const hasMovesLeft = newRemainingAttacks > 0;
    await this.prismaService.$transaction(async tx => {
      const updatedPlayer = await tx.battleRoyalPlayer.update({
        where: { id: player.id },
        data: {
          remainingAttacks: newRemainingAttacks,
          kills,
          damageDealt,
        },
        include: {
          room: {
            include: {
              players: {
                where: { isAlive: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      });

      const shouldShrinkZone = (updatedPlayer.room.turnNumber + 1) % 8 === 0;

      if (shouldShrinkZone) {
        const newSafeZoneRadius = Math.max(
          1,
          updatedPlayer.room.safeZoneRadius - 2
        );
        await tx.battleRoyalRoom.update({
          where: { id: updatedPlayer.room.id },
          data: {
            safeZoneRadius: newSafeZoneRadius,
            nextShrinkTurn: updatedPlayer.room.turnNumber + 9,
          },
        });
      }
      const shouldHitPlayerZone = (updatedPlayer.room.turnNumber + 1) % 2 === 0;

      if (shouldHitPlayerZone) {
        const alivePlayers = await tx.battleRoyalPlayer.findMany({
          where: {
            roomId: updatedPlayer.room.id,
            isAlive: true,
          },
        });

        for (const player of alivePlayers) {
          if (
            !calculateSafeZone(
              player.x,
              player.y,
              updatedPlayer.room.fieldSize,
              updatedPlayer.room.safeZoneRadius
            )
          ) {
            const newLives = player.lives - 1;
            const isAlive = newLives > 0;

            await tx.battleRoyalPlayer.update({
              where: { id: player.id },
              data: {
                lives: newLives,
                isAlive,
                ...(!isAlive && {
                  eliminatedBy: 'SAFE_ZONE_SHRINK',
                  eliminationOrder: await this.getNextEliminationOrder(
                    updatedPlayer.room.id
                  ),
                }),
              },
            });
          }
        }
      }

      const alivePlayersForEnd = await tx.battleRoyalPlayer.findMany({
        where: {
          roomId: updatedPlayer.room.id,
          isAlive: true,
        },
      });

      if (!hasMovesLeft || alivePlayersForEnd.length <= 1) {
        await this.passTurnToNextPlayer(tx, updatedPlayer);
      }
    });
  }

  private async passTurnToNextPlayer(
    tx: TransactionClient,
    currentPlayer: BattleRoyalPlayer & {
      room: BattleRoyalRoom & {
        players: BattleRoyalPlayer[];
      };
    }
  ) {
    const alivePlayers = currentPlayer.room.players.filter(p => p.isAlive);
    const currentPlayerIndex = alivePlayers.findIndex(
      p => p.id === currentPlayer.id
    );

    let nextPlayerIndex = -1;

    if (alivePlayers.length > 1) {
      for (let i = 1; i < alivePlayers.length; i++) {
        const nextIndex = (currentPlayerIndex + i) % alivePlayers.length;
        if (alivePlayers[nextIndex].isAlive) {
          nextPlayerIndex = nextIndex;
          break;
        }
      }
    }

    if (nextPlayerIndex !== -1) {
      const nextPlayer = alivePlayers[nextPlayerIndex];

      await tx.battleRoyalRoom.update({
        where: { id: currentPlayer.room.id },
        data: {
          playerTurn: nextPlayer.id,
          turnNumber: currentPlayer.room.turnNumber + 1,
        },
      });

      await tx.battleRoyalPlayer.update({
        where: { id: nextPlayer.id },
        data: {
          remainingMoves: 1 + nextPlayer.movementBoost,
          remainingAttacks: 1 + nextPlayer.attackBoost,
        },
      });
    } else {
      await this.handleGameCompletion(tx, currentPlayer.room.id);
    }
  }

  private async handleGameCompletion(tx: TransactionClient, roomId: string) {
    const winner = await tx.battleRoyalPlayer.findFirst({
      where: {
        roomId,
        isAlive: true,
      },
      include: {
        user: true,
      },
    });

    if (!winner) {
      throw new Error('No winner found for game completion');
    }

    const gameResult = await tx.battleRoyalGameResult.create({
      data: {
        roomId,
        winnerId: winner.userId,
      },
    });

    const allPlayers = await tx.battleRoyalPlayer.findMany({
      where: { roomId },
      include: { user: true },
    });

    for (const player of allPlayers) {
      if (player.user) {
        const isWinner = player.id === winner.id;
        const ratingChange = isWinner ? 30 : -20;
        const oldRating = player.user.rating || 0;
        const newRating = Math.max(0, oldRating + ratingChange);

        await tx.user.update({
          where: { id: player.user.id },
          data: { rating: newRating },
        });

        await tx.battleRoyalRatingHistory.create({
          data: {
            userId: player.user.id,
            gameResultId: gameResult.id,
            oldRating,
            newRating,
            ratingChange,
          },
        });
      }
    }

    await tx.battleRoyalRoom.update({
      where: { id: roomId },
      data: {
        playerTurn: null,
        status: BattleRoyalRoomStatus.FINISHED,
      },
    });

    return {
      winnerId: winner.userId,
      gameResultId: gameResult.id,
      playersCount: allPlayers.length,
    };
  }

  private async getNextEliminationOrder(roomId: string): Promise<number> {
    const eliminatedPlayers = await this.prismaService.battleRoyalPlayer.count({
      where: {
        roomId,
        isAlive: false,
        eliminationOrder: { not: null },
      },
    });

    return eliminatedPlayers + 1;
  }

  async battleRoyalUserExtraLive(player: BattleRoyalPlayer) {
    const newLive = Math.min(player.maxLives, player.lives + 1);
    await this.prismaService.battleRoyalPlayer.update({
      where: {
        id: player.id,
      },
      data: {
        lives: newLive,
      },
    });
  }

  async battleRoyalUserBonusUpdate(
    playerId: string,
    upgradeSlots: BattleRoyalUpgradeSlot[],
    dto: BattleRoyalBonusDto
  ) {
    const updateSlot = upgradeSlots.map(slot =>
      slot.slotIndex === dto.slotIndex
        ? { ...slot, upgradeType: dto.upgrade.upgradeType }
        : slot
    );

    const movementBoost = updateSlot.reduce(
      (acc, slot) =>
        slot.upgradeType === BattleRoyalUpgradeType.MOVEMENT_BOOST
          ? acc + 2
          : acc,
      0
    );
    const attackBoost = updateSlot.reduce(
      (acc, slot) =>
        slot.upgradeType === BattleRoyalUpgradeType.ATTACK_BOOST
          ? acc + 1
          : acc,
      0
    );
    const visionRadius = updateSlot.reduce(
      (acc, slot) =>
        slot.upgradeType === BattleRoyalUpgradeType.VISION_BOOST
          ? acc + 2
          : acc,
      3
    );

    await this.prismaService.$transaction(async tx => {
      const updatedPlayer = await tx.battleRoyalPlayer.update({
        where: {
          id: playerId,
        },
        data: {
          movementBoost,
          attackBoost,
          visionRadius,
          upgradeSlots: {
            updateMany: {
              where: { playerId, slotIndex: dto.slotIndex },
              data: {
                upgradeType: dto.upgrade.upgradeType,
                updatedAt: new Date(),
              },
            },
          },
        },
        include: {
          upgradeSlots: true,
        },
      });

      const visibleCells = generateVisibleCells(
        updatedPlayer.id,
        updatedPlayer.x,
        updatedPlayer.y,
        updatedPlayer.visionRadius
      );

      await tx.battleRoyalVisibleCell.deleteMany({
        where: { playerId: playerId },
      });

      await tx.battleRoyalVisibleCell.createMany({
        data: visibleCells,
        skipDuplicates: true,
      });
    });
  }

  async battleRoyalBonusCollected(
    roomId: string,
    playerId: string,
    dto: BattleRoyalBonusDto
  ) {
    await this.prismaService.battleRoyalUpgrade.update({
      where: {
        roomId_x_y: {
          roomId: roomId,
          x: dto.upgrade.x,
          y: dto.upgrade.y,
        },
      },
      data: {
        isCollected: true,
        collectedBy: playerId,
        collectedAt: new Date(),
      },
    });
  }

  async getBattleRoyalGameData(
    roomId: string,
    userId: string
  ): Promise<BattleRoyalGameData> {
    const room = await this.prismaService.battleRoyalRoom.findUnique({
      where: { id: roomId },
      include: {
        players: {
          include: {
            upgradeSlots: true,
            visibleCells: true,
            user: true,
          },
        },
        upgrades: true,
      },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status === 'WAITING') {
      throw new Error('Game not started yet');
    }

    const myPlayer = room.players.find(p => p.userId === userId);
    if (!myPlayer) {
      throw new Error('Player not found in this room');
    }

    const otherPlayers = room.players.filter(p => p.userId !== userId);

    const visibleCells = myPlayer.visibleCells.map(cell => ({
      x: cell.x,
      y: cell.y,
    }));

    const visibleUpgrades = room.upgrades.filter(upgrade => {
      const isInVisibleCells = visibleCells.some(
        cell => cell.x === upgrade.x && cell.y === upgrade.y
      );

      return isInVisibleCells && !upgrade.isCollected;
    });

    return {
      room: {
        id: room.id,
        status: room.status,
        turnNumber: room.turnNumber,
        fieldSize: room.fieldSize,
        playerTurn: room.playerTurn,
        safeZoneRadius: room.safeZoneRadius,
        nextShrinkTurn: room.nextShrinkTurn,
        isMyTurn: room.playerTurn === myPlayer.id,
      },
      myPlayer: {
        id: myPlayer.id,
        user: myPlayer.user,
        x: myPlayer.x,
        y: myPlayer.y,
        lives: myPlayer.lives,
        maxLives: myPlayer.maxLives,
        remainingMoves: myPlayer.remainingMoves,
        remainingAttacks: myPlayer.remainingAttacks,
        movementBoost: myPlayer.movementBoost,
        attackBoost: myPlayer.attackBoost,
        visionRadius: myPlayer.visionRadius,
        upgradeSlots: myPlayer.upgradeSlots.map(slot => ({
          slotIndex: slot.slotIndex,
          upgradeType: slot.upgradeType,
        })),
        visibleCells,
      },
      otherPlayers: otherPlayers.map(player => ({
        id: player.id,
        user: player.user,
        x: player.x,
        y: player.y,
        lives: player.lives,
        isAlive: player.isAlive,
      })),
      upgrades: room.upgrades.map(upgrade => ({
        id: upgrade.id,
        x: upgrade.x,
        y: upgrade.y,
        upgradeType: upgrade.upgradeType,
        isCollected: upgrade.isCollected,
      })),
      visibleUpgrades: visibleUpgrades.map(upgrade => ({
        id: upgrade.id,
        x: upgrade.x,
        y: upgrade.y,
        upgradeType: upgrade.upgradeType,
        isCollected: upgrade.isCollected,
      })),
    };
  }

  async getGameResults(roomId: string) {
    try {
      const gameResult =
        await this.prismaService.battleRoyalGameResult.findFirst({
          where: { roomId },
          include: {
            winner: {
              select: {
                id: true,
                displayName: true,
                picture: true,
                rating: true,
              },
            },
            room: {
              select: {
                id: true,
                turnNumber: true,
                fieldSize: true,
                createdAt: true,
                updatedAt: true,
                status: true,
              },
            },
            ratingHistory: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    picture: true,
                    rating: true,
                  },
                },
              },
            },
          },
        });

      if (!gameResult) {
        {
          return null;
        }
      }

      const players = await this.prismaService.battleRoyalPlayer.findMany({
        where: { roomId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              picture: true,
              rating: true,
            },
          },
        },
        orderBy: [{ isAlive: 'desc' }, { eliminationOrder: 'asc' }],
      });

      const result: GameResultSummary = {
        gameResult,
        winner: gameResult.winner
          ? {
              id: gameResult.winner.id,
              displayName: gameResult.winner.displayName,
              picture: gameResult.winner.picture,
              rating: gameResult.winner.rating || 0,
            }
          : null,
        room: {
          id: gameResult.room.id,
          turnNumber: gameResult.room.turnNumber,
          fieldSize: gameResult.room.fieldSize,
          createdAt: gameResult.room.createdAt,
          finishedAt: gameResult.room.updatedAt,
        },
        players: players.map(player => {
          const ratingHistory = gameResult.ratingHistory.find(
            rh => rh.userId === player.userId
          );

          return {
            id: player.id,
            displayName: player.user.displayName,
            picture: player.user.picture,
            rating: player.user.rating || 0,
            ratingChange: ratingHistory?.ratingChange || 0,
            kills: player.kills,
            damageDealt: player.damageDealt,
            distanceTraveled: player.distanceTraveled,
            eliminationOrder: player.eliminationOrder,
            isWinner: player.userId === gameResult.winnerId,
          };
        }),
        totalPlayers: players.length,
      };

      return result;
    } catch (error) {
      console.error('Error fetching game results:', error);
      throw new Error('Failed to fetch game results');
    }
  }
}
