import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendRequest } from 'prisma/generated/client';
import { FriendRequestStatus } from 'prisma/generated/enums';

import { PrismaService } from '@/prisma/prisma.service';
import { UserService } from '@/user/user.service';

@Injectable()
export class FriendService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService
  ) {}

  public async getFriends(userId: string) {
    const friendRequests = await this.prismaService.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            displayName: true,
            picture: true,
            rating: true,
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            displayName: true,
            picture: true,
            rating: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const friends = friendRequests.map(request => {
      const friend =
        request.senderId === userId ? request.receiver : request.sender;
      return {
        user: {
          id: friend.id,
          email: friend.email,
          displayName: friend.displayName,
          picture: friend.picture,
          rating: friend.rating,
        },
        status: request.status,
        friendshipId: request.id,
        becameFriendsAt: request.updatedAt,
      };
    });

    return friends;
  }

  public async getFriendsSends(userId: string) {
    const sentRequests = await this.prismaService.friendRequest.findMany({
      where: {
        senderId: userId,
        status: 'PENDING',
      },
      include: {
        receiver: {
          select: {
            id: true,
            email: true,
            displayName: true,
            picture: true,
            rating: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sentRequests.map(request => ({
      requestId: request.id,
      status: request.status,
      sentAt: request.createdAt,
      user: request.receiver,
    }));
  }

  public async getFriendsRequest(userId: string) {
    const receivedRequests = await this.prismaService.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            displayName: true,
            picture: true,
            rating: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return receivedRequests.map(request => ({
      requestId: request.id,
      status: request.status,
      receivedAt: request.createdAt,
      user: request.sender,
    }));
  }

  public async getFriendsSearch(userId: string, search: string) {
    return await this.prismaService.user.findMany({
      where: {
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
        NOT: {
          id: userId,
        },
        AND: [
          {
            // Исключаем только ACCEPTED и PENDING статусы
            receivedFriendRequests: {
              none: {
                senderId: userId,
                status: {
                  in: [
                    FriendRequestStatus.ACCEPTED,
                    FriendRequestStatus.PENDING,
                  ],
                },
              },
            },
          },
          {
            sendFriendRequests: {
              none: {
                receiverId: userId,
                status: {
                  in: [
                    FriendRequestStatus.ACCEPTED,
                    FriendRequestStatus.PENDING,
                  ],
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        displayName: true,
        picture: true,
        rating: true,
      },
      take: 20,
    });
  }

  public async getFriendsStats(userId: string) {
    const [sentPending, receivedPending, accepted] = await Promise.all([
      this.prismaService.friendRequest.count({
        where: {
          senderId: userId,
          status: 'PENDING',
        },
      }),
      this.prismaService.friendRequest.count({
        where: {
          receiverId: userId,
          status: 'PENDING',
        },
      }),
      this.prismaService.friendRequest.count({
        where: {
          status: 'ACCEPTED',
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
      }),
    ]);

    return {
      sentPending,
      receivedPending,
      accepted,
      total: accepted,
    };
  }

  public async createRequest(senderId: string, receiverId: string) {
    const { sender, receiver } = await this.getUsers(senderId, receiverId);

    const existing = await this.findFriendRequest(sender.id, receiver.id);

    if (existing && existing.status !== FriendRequestStatus.ACCEPTED) {
      return await this.updateFriendRequest({
        ...existing,
        senderId: sender.id,
        receiverId: receiver.id,
        status: FriendRequestStatus.PENDING,
      });
    }

    return await this.prismaService.friendRequest.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        status: FriendRequestStatus.PENDING,
      },
    });
  }

  public async acceptRequest(senderId: string, receiverId: string) {
    return await this.updateFriendRequestStatus(
      senderId,
      receiverId,
      FriendRequestStatus.ACCEPTED
    );
  }

  public async rejectRequest(senderId: string, receiverId: string) {
    return await this.updateFriendRequestStatus(
      senderId,
      receiverId,
      FriendRequestStatus.REJECTED
    );
  }

  public async removeFriend(senderId: string, receiverId: string) {
    const { sender, receiver } = await this.getUsers(senderId, receiverId);

    const existing = await this.findFriendRequest(sender.id, receiver.id);

    if (!existing) {
      throw new NotFoundException('Friend request not found');
    }

    return await this.prismaService.friendRequest.delete({
      where: {
        id: existing?.id,
      },
    });
  }

  private async updateFriendRequestStatus(
    senderId: string,
    receiverId: string,
    status: FriendRequestStatus
  ) {
    const { sender, receiver } = await this.getUsers(senderId, receiverId);

    const existing = await this.findFriendRequest(sender.id, receiver.id);

    if (!existing) {
      throw new NotFoundException('Friend request not found.');
    }

    if (
      existing.status === FriendRequestStatus.ACCEPTED &&
      status !== FriendRequestStatus.ACCEPTED
    ) {
      throw new BadRequestException('Accepted request cannot be changed.');
    }

    return await this.updateFriendRequest({
      ...existing,
      status,
    });
  }

  private async getUsers(senderId: string, receiverId: string) {
    const [sender, receiver] = await Promise.all([
      this.userService.findById(senderId),
      this.userService.findById(receiverId),
    ]);

    return { sender, receiver };
  }

  private async findFriendRequest(senderId: string, receiverId: string) {
    const existing = await this.prismaService.friendRequest.findFirst({
      where: {
        OR: [
          {
            senderId,
            receiverId,
          },
          {
            senderId: receiverId,
            receiverId: senderId,
          },
        ],
      },
    });

    return existing;
  }

  private async updateFriendRequest(friendRequest: FriendRequest) {
    return await this.prismaService.friendRequest.update({
      where: {
        id: friendRequest.id,
      },
      data: {
        receiverId: friendRequest.receiverId,
        senderId: friendRequest.senderId,
        status: friendRequest.status,
      },
    });
  }
}
