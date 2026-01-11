import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { SocketSessionService } from '@/redis/socket-session.service';
import { WebSocketServerTypes } from '@/redis/types/web-sockets.types';

import { FriendRequestDto } from './dto/friend-request.dto';
import { InviteRequestDto } from './dto/invite-request.dto';
import { NotificationService } from './notification.service';

@WebSocketGateway({ namespace: 'notification' })
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly socketSessionService: SocketSessionService
  ) {}

  afterInit(server: Server) {
    this.socketSessionService.setWebSocketServer(
      server,
      WebSocketServerTypes.NOTIFICATION
    );
  }

  async handleConnection(socket: Socket) {
    try {
      const userId = socket.handshake.auth?.userId as string;

      if (!userId) {
        socket.disconnect();
        return;
      }

      await this.socketSessionService.registerSocket(
        userId,
        socket,
        WebSocketServerTypes.NOTIFICATION
      );
      this.socketSessionService.setWebSocketServer(
        this.server,
        WebSocketServerTypes.NOTIFICATION
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error in handleConnection: ${error.message}`);
      } else {
        console.error('Error in handleConnection:', error);
      }
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    try {
      const userId: string = socket.handshake.auth?.userId as string;
      if (userId) {
        await this.socketSessionService.unregisterSocket(
          userId,
          WebSocketServerTypes.NOTIFICATION
        );
      }
    } catch (error) {
      console.error('Error in handleDisconnect:', error);
    }
  }

  @SubscribeMessage('friend_request')
  async createRequest(socket: Socket, dto: FriendRequestDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.notificationService.createRequest(userId, dto.receiverId);
  }

  @SubscribeMessage('accept_request')
  async acceptRequest(socket: Socket, dto: FriendRequestDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.notificationService.acceptRequest(userId, dto.receiverId);
  }

  @SubscribeMessage('reject_request')
  async rejectRequest(socket: Socket, dto: FriendRequestDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.notificationService.rejectRequest(userId, dto.receiverId);
  }

  @SubscribeMessage('remove_request')
  async removeFriend(socket: Socket, dto: FriendRequestDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.notificationService.removeFriend(userId, dto.receiverId);
  }

  @SubscribeMessage('invite_request')
  async inviteFriend(socket: Socket, dto: InviteRequestDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.notificationService.inviteFriend(
      userId,
      dto.receiverId,
      dto.gameId
    );
  }

  @SubscribeMessage('invite_accept')
  async inviteAccept(socket: Socket, dto: InviteRequestDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.notificationService.inviteAccept(
      userId,
      dto.receiverId,
      dto.gameId
    );
  }

  @SubscribeMessage('invite_reject')
  async inviteReject(socket: Socket, dto: InviteRequestDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.notificationService.inviteReject(userId, dto.receiverId);
  }

  @SubscribeMessage('invite_expire')
  async inviteExpired(socket: Socket, dto: InviteRequestDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.notificationService.inviteExpired(userId, dto.receiverId);
  }
}
