import { Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'argon2';
import { Response } from 'express';
import { AuthMethod } from 'prisma/generated/enums';

import { MulterFile } from '@/libs/common/yandex-storage/interfaces/multer-file.interface';
import { YandexDiskService } from '@/libs/common/yandex-storage/yandex-storage.service';
import { PrismaService } from '@/prisma/prisma.service';

import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly yandexDiskService: YandexDiskService
  ) {}

  public async findById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      include: { accounts: true },
    });

    if (!user) {
      throw new NotFoundException(`User is not found. Please check the data.`);
    }

    return user;
  }

  public async findByEmail(email: string) {
    const user = await this.prismaService.user.findUnique({
      where: { email },
      include: { accounts: true },
    });

    if (!user) {
      throw new NotFoundException(`User is not found. Please check the data.`);
    }

    return user;
  }

  public async findByEmailForRegister(email: string) {
    const user = await this.prismaService.user.findUnique({
      where: { email },
      include: { accounts: true },
    });

    return user;
  }

  public async create(
    email: string,
    password: string,
    displayName: string,
    picture: string,
    method: AuthMethod,
    rating: number,
    isVerified: boolean
  ) {
    const user = await this.prismaService.user.create({
      data: {
        email,
        password: password ? await hash(password) : '',
        displayName,
        picture,
        method,
        rating,
        isVerified,
      },
      include: { accounts: true },
    });

    return user;
  }

  public async update(userId: string, dto: UpdateUserDto) {
    const user = await this.findById(userId);

    const updatedUser = await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        email: dto.email,
        displayName: dto.name,
        isTwoFactorEnable: dto.isTwoFactorEnable,
      },
    });

    return updatedUser;
  }

  // async updateRating(winnerId: string, loserId: string, health: number) {
  //   const [winner, loser] = await Promise.all([
  //     this.userModel.findById(new Types.ObjectId(winnerId)),
  //     this.userModel.findById(new Types.ObjectId(loserId)),
  //   ]);

  //   const winnerScore = 40;
  //   const loserScore = 20 + health;
  //   if (winner && loser) {
  //     const newWinnerRating = (winner.rating ? winner.rating : 0) + winnerScore;
  //     const newLoserRating =
  //       (loser.rating ? loser.rating : 0) - loserScore >= 0
  //         ? (loser.rating ? loser.rating : 0) - loserScore
  //         : 0;

  //     await Promise.all([
  //       this.userModel.updateOne(
  //         { _id: new Types.ObjectId(winnerId) },
  //         { rating: newWinnerRating }
  //       ),
  //       this.userModel.updateOne(
  //         { _id: new Types.ObjectId(loserId) },
  //         { rating: newLoserRating }
  //       ),
  //     ]);
  //     return { newWinnerRating, newLoserRating };
  //   }

  //   return null;
  // }

  async uploadUserAvatar(userId: string, file: MulterFile) {
    const user = await this.findById(userId);

    const uploadAvatar = await this.yandexDiskService.uploadUserAvatar(
      userId,
      file
    );

    const updatedUser = await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        picture: uploadAvatar.url,
      },
    });

    return updatedUser;
  }

  getUserAvatar(filename: string, res: Response) {
    return this.yandexDiskService.streamFile(filename, res);
  }
}
