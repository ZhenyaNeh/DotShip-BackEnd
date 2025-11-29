import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { env } from 'prisma/config';
import { PrismaClient } from 'prisma/generated/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const pool = new PrismaPg({ connectionString: env('POSTGRES_DB_URI') });
    super({ adapter: pool });
  }
  public async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
