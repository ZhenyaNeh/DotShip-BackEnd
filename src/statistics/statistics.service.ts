import { Injectable } from '@nestjs/common';
import { subDays, subHours, subMonths } from 'date-fns';
import { GameMode } from 'prisma/generated/enums';

import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getUserStats(userId: string) {
    const [classicWins, classicTotalGames, brWins, brTotalGames] =
      await Promise.all([
        this.prismaService.gameResult.count({
          where: { winnerId: userId },
        }),

        this.prismaService.player.count({
          where: {
            userId: userId,
            room: {
              gameResults: { some: {} },
            },
          },
        }),

        this.prismaService.battleRoyalGameResult.count({
          where: { winnerId: userId },
        }),

        this.prismaService.battleRoyalPlayer.count({
          where: {
            userId: userId,
            room: {
              battleRoyalGameResult: { some: {} },
            },
          },
        }),
      ]);

    return {
      classic: {
        wins: classicWins,
        losses: Math.max(0, classicTotalGames - classicWins),
      },
      battleRoyal: {
        wins: brWins,
        losses: Math.max(0, brTotalGames - brWins),
      },
    };
  }

  async getRatingProgression(userId: string) {
    const threeMonthsAgo = subMonths(new Date(), 3);

    const [classicHistory, battleRoyalHistory] = await Promise.all([
      this.prismaService.ratingHistory.findMany({
        where: {
          userId,
          createdAt: { gte: threeMonthsAgo },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          newRating: true,
          createdAt: true,
        },
      }),

      this.prismaService.battleRoyalRatingHistory.findMany({
        where: {
          userId,
          createdAt: { gte: threeMonthsAgo },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          newRating: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      classic: classicHistory,
      battleRoyal: battleRoyalHistory,
    };
  }

  async getLastGames(userId: string) {
    const [classicGames, battleRoyalGames] = await Promise.all([
      this.prismaService.player.findMany({
        where: { userId },
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          room: {
            include: {
              game: {
                select: { displayName: true, picture: true, gameMode: true },
              },
              gameResults: {
                select: { winnerId: true, createdAt: true },
              },
            },
          },
        },
      }),
      this.prismaService.battleRoyalPlayer.findMany({
        where: { userId },
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          room: {
            include: {
              game: {
                select: { displayName: true, picture: true },
              },
              battleRoyalGameResult: {
                select: { winnerId: true, createdAt: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      classic: classicGames.map(p => ({
        roomId: p.roomId,
        gameName: p.room.game.displayName,
        gamePicture: p.room.game.picture,
        date: p.createdAt,
        gameMode: p.room.game.gameMode,
        result:
          p.room.gameResults.length > 0
            ? p.room.gameResults[0].winnerId === userId
              ? 'WIN'
              : 'LOSS'
            : 'IN_PROGRESS',
      })),
      battleRoyal: battleRoyalGames.map(p => ({
        roomId: p.roomId,
        gameName: p.room.game.displayName,
        gamePicture: p.room.game.picture,
        date: p.createdAt,
        isAlive: p.isAlive,
        kills: p.kills,
        result:
          p.room.battleRoyalGameResult.length > 0
            ? p.room.battleRoyalGameResult[0].winnerId === userId
              ? 'WIN'
              : 'LOSS'
            : 'IN_PROGRESS',
      })),
    };
  }

  async getAllNonAdminUsers() {
    return await this.prismaService.user.findMany({
      where: {
        role: {
          not: 'ADMIN',
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        picture: true,
        role: true,
        rating: true,
      },
    });
  }

  async getActiveGames() {
    const oneHourAgo = subHours(new Date(), 1);

    const [classicRooms, battleRoyalRooms] = await Promise.all([
      this.prismaService.room.findMany({
        where: {
          createdAt: { lt: oneHourAgo },
          gameResults: { none: {} },
        },
        include: {
          game: { select: { displayName: true, gameMode: true } },
          players: {
            include: {
              user: { select: { displayName: true, picture: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      this.prismaService.battleRoyalRoom.findMany({
        where: {
          createdAt: { lt: oneHourAgo },
          status: { in: ['WAITING', 'IN_PROGRESS'] },
          battleRoyalGameResult: { none: {} },
        },
        include: {
          game: { select: { displayName: true, gameMode: true } },
          players: {
            include: {
              user: { select: { displayName: true, picture: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedClassic = classicRooms.map(room => ({
      ...room,
      status: 'IN_PROGRESS',
      type: 'CLASSIC',
    }));

    const formattedBR = battleRoyalRooms.map(room => ({
      ...room,
      type: 'BATTLE_ROYAL',
    }));

    const allGames = [...formattedClassic, ...formattedBR].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    return allGames;
  }

  async getAdminDashboardStats() {
    const dayAgo = subDays(new Date(), 1);

    const [
      totalUsers,
      newUsers24h,
      activeClassicRooms,
      activeBRRooms,
      totalFinishedClassic,
      totalFinishedBR,
      topGamesByPopularity,
    ] = await Promise.all([
      this.prismaService.user.count(),

      this.prismaService.user.count({
        where: { createdAt: { gte: dayAgo } },
      }),

      this.prismaService.room.count({
        where: { gameResults: { none: {} } },
      }),

      this.prismaService.battleRoyalRoom.count({
        where: { status: 'IN_PROGRESS' },
      }),

      this.prismaService.gameResult.count(),

      this.prismaService.battleRoyalGameResult.count(),

      this.prismaService.game.findMany({
        select: {
          displayName: true,
          _count: {
            select: { rooms: true, battleRoyalRooms: true },
          },
        },
        orderBy: {
          rooms: { _count: 'desc' },
        },
        take: 5,
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        newLast24h: newUsers24h,
      },
      currentActivity: {
        classicActiveRooms: activeClassicRooms,
        battleRoyalActiveRooms: activeBRRooms,
      },
      globalHistory: {
        classicFinishedTotal: totalFinishedClassic,
        battleRoyalFinishedTotal: totalFinishedBR,
      },
      popularity: topGamesByPopularity.map(g => ({
        name: g.displayName,
        totalStarts: g._count.rooms + g._count.battleRoyalRooms,
      })),
    };
  }

  async deleteRoom(roomId: string, type: GameMode) {
    return await this.prismaService.$transaction(async tx => {
      if (type === GameMode.CLASSIC || type === GameMode.EVENTS) {
        const players = await tx.player.findMany({ where: { roomId } });
        const playerIds = players.map(p => p.id);

        await tx.move.deleteMany({ where: { playerId: { in: playerIds } } });
        await tx.ship.deleteMany({ where: { playerId: { in: playerIds } } });

        const results = await tx.gameResult.findMany({ where: { roomId } });
        const resultIds = results.map(r => r.id);
        await tx.ratingHistory.deleteMany({
          where: { gameResultId: { in: resultIds } },
        });

        await tx.gameResult.deleteMany({ where: { roomId } });

        await tx.player.deleteMany({ where: { roomId } });

        return await tx.room.delete({ where: { id: roomId } });
      } else if (type === GameMode.BATTLE_ROYAL) {
        const players = await tx.battleRoyalPlayer.findMany({
          where: { roomId },
        });
        const playerIds = players.map(p => p.id);

        await tx.battleRoyalVisibleCell.deleteMany({
          where: { playerId: { in: playerIds } },
        });
        await tx.battleRoyalUpgradeSlot.deleteMany({
          where: { playerId: { in: playerIds } },
        });

        await tx.battleRoyalUpgrade.deleteMany({ where: { roomId } });

        const results = await tx.battleRoyalGameResult.findMany({
          where: { roomId },
        });
        const resultIds = results.map(r => r.id);
        await tx.battleRoyalRatingHistory.deleteMany({
          where: { gameResultId: { in: resultIds } },
        });

        await tx.battleRoyalGameResult.deleteMany({ where: { roomId } });

        await tx.battleRoyalPlayer.deleteMany({ where: { roomId } });

        return await tx.battleRoyalRoom.delete({ where: { id: roomId } });
      }
    });
  }
}
