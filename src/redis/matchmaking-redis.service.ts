import { Injectable } from '@nestjs/common';

import { ParsedPlayer } from '@/matchmaking/types/parsed-player.types';
import { ParsedReady } from '@/matchmaking/types/parsed-ready.types';

import { RedisBaseService } from './redis-base.service';

@Injectable()
export class MatchmakingRedisService extends RedisBaseService {
  private readonly QUEUE_TTL = 10 * 60;
  private readonly READY_TTL = 10 * 60;

  private queueKey(gameId: string): string {
    return `matchmaking:queue:${gameId}`;
  }

  private readyKey(roomId: string): string {
    return `matchmaking:ready:${roomId}`;
  }

  async addToQueue(gameId: string, player: ParsedPlayer): Promise<void> {
    this.ensureRedisConnected();
    const key = this.queueKey(gameId);
    await this.redisClient.rPush(key, JSON.stringify(player));
    await this.redisClient.expire(key, this.QUEUE_TTL);
  }

  async popFromQueue(gameId: string): Promise<ParsedPlayer> {
    this.ensureRedisConnected();
    const key = this.queueKey(gameId);
    const playerRaw = await this.redisClient.lPop(key);

    if (!playerRaw || typeof playerRaw !== 'string') return null;

    try {
      return JSON.parse(playerRaw) as ParsedPlayer;
    } catch {
      return null;
    }
  }

  async returnToQueue(gameId: string, player: ParsedPlayer): Promise<void> {
    this.ensureRedisConnected();
    const key = this.queueKey(gameId);
    await this.redisClient.rPush(key, JSON.stringify(player));
    await this.redisClient.expire(key, this.QUEUE_TTL);
  }

  async removeFromQueue(gameId: string, userId: string): Promise<boolean> {
    this.ensureRedisConnected();
    const key = this.queueKey(gameId);
    const list = await this.redisClient.lRange(key, 0, -1);

    for (const item of list) {
      try {
        const parsed = JSON.parse(item) as ParsedPlayer;
        if (parsed.userId === userId) {
          await this.redisClient.lRem(key, 0, item);
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  async getQueueSize(gameId: string): Promise<number> {
    this.ensureRedisConnected();
    const key = this.queueKey(gameId);
    return await this.redisClient.lLen(key);
  }

  async findUserInQueue(gameId: string, userId: string): Promise<ParsedPlayer> {
    this.ensureRedisConnected();
    const key = this.queueKey(gameId);
    const list = await this.redisClient.lRange(key, 0, -1);

    for (const item of list) {
      try {
        const parsed = JSON.parse(item) as ParsedPlayer;
        if (parsed.userId === userId) {
          return parsed;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async setPlayerReady(
    roomId: string,
    readyPlayer: ParsedReady
  ): Promise<number> {
    const key = this.readyKey(roomId);

    const playerData = JSON.stringify(readyPlayer);

    await this.redisClient.hSet(key, readyPlayer.userId, playerData);
    await this.redisClient.expire(key, this.READY_TTL);

    return await this.redisClient.hLen(key);
  }

  async getReadyPlayers(roomId: string): Promise<ParsedReady[]> {
    const key = this.readyKey(roomId);
    const playersData = await this.redisClient.hGetAll(key);

    return Object.values(playersData).map(data => {
      try {
        const parsed = JSON.parse(data) as ParsedReady;
        // Базовые проверки
        if (!parsed.userId || !Array.isArray(parsed.ships)) {
          throw new Error('Invalid player data structure');
        }
        return parsed;
      } catch (error) {
        // Логируем ошибку, но возвращаем пустой объект или выбрасываем исключение
        console.error('Failed to parse player data:', error);
        throw new Error('Corrupted player data in storage');
      }
    });
  }

  async removePlayerReady(roomId: string, userId: string): Promise<number> {
    const key = this.readyKey(roomId);
    await this.redisClient.hDel(key, userId);

    const count = await this.redisClient.hLen(key);
    if (count === 0) {
      await this.redisClient.del(key);
    }

    return count;
  }

  async clearReadyRoom(roomId: string): Promise<void> {
    const key = this.readyKey(roomId);
    await this.redisClient.del(key);
  }
}
