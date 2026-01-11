import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisBaseService implements OnModuleInit, OnModuleDestroy {
  protected redisClient: RedisClientType;

  constructor(protected readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeRedis();
  }

  protected async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: this.configService.getOrThrow('REDIS_DB_URI'),
      });

      this.redisClient.on('error', err =>
        console.error('Redis Client Error', err)
      );

      await this.redisClient.connect();
    } catch (error) {
      console.error('Redis connection failed', error);
      throw error;
    }
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.destroy();
    }
  }

  protected ensureRedisConnected(): void {
    if (!this.redisClient || !this.redisClient.isOpen) {
      throw new Error('Redis client is not connected');
    }
  }

  protected async setWithExpire(
    key: string,
    value: any,
    ttlSeconds: number = 3600
  ): Promise<void> {
    this.ensureRedisConnected();
    await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  }

  protected async getParsed<T>(key: string): Promise<T> {
    this.ensureRedisConnected();
    const data = await this.redisClient.get(key);
    return data && typeof data === 'string' ? (JSON.parse(data) as T) : null;
  }
}
