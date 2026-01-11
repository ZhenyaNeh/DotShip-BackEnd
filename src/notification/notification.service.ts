import { Injectable } from '@nestjs/common';

import { FriendService } from '@/friend/friend.service';
import { SocketSessionService } from '@/redis/socket-session.service';
import { WebSocketServerTypes } from '@/redis/types/web-sockets.types';
import { UserService } from '@/user/user.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly friendService: FriendService,
    private readonly socketSessionService: SocketSessionService,
    private readonly userService: UserService
  ) {}

  public async createRequest(senderId: string, receiverId: string) {
    const friendRequest = await this.friendService.createRequest(
      senderId,
      receiverId
    );

    const senderUser = await this.userService.findById(friendRequest.senderId);

    await this.socketSessionService.sendToUser(
      friendRequest.receiverId,
      'request_result',
      { sendFrom: senderUser.displayName },
      WebSocketServerTypes.NOTIFICATION
    );
    await this.socketSessionService.sendToUser(
      friendRequest.senderId,
      'request_result_success',
      {},
      WebSocketServerTypes.NOTIFICATION
    );

    return friendRequest;
  }

  public async acceptRequest(senderId: string, receiverId: string) {
    const acceptedRequest = await this.friendService.acceptRequest(
      senderId,
      receiverId
    );

    const receiverUser = await this.userService.findById(
      acceptedRequest.receiverId
    );

    await this.socketSessionService.sendToUser(
      acceptedRequest.senderId,
      'accept_result',
      { sendFrom: receiverUser.displayName },
      WebSocketServerTypes.NOTIFICATION
    );
    await this.socketSessionService.sendToUser(
      acceptedRequest.receiverId,
      'accept_result_success',
      {},
      WebSocketServerTypes.NOTIFICATION
    );

    return acceptedRequest;
  }

  public async rejectRequest(senderId: string, receiverId: string) {
    const rejectedRequest = await this.friendService.rejectRequest(
      senderId,
      receiverId
    );

    const receiverUser = await this.userService.findById(
      rejectedRequest.receiverId
    );

    await this.socketSessionService.sendToUser(
      rejectedRequest.senderId,
      'reject_result',
      { sendFrom: receiverUser.displayName },
      WebSocketServerTypes.NOTIFICATION
    );
    await this.socketSessionService.sendToUser(
      rejectedRequest.receiverId,
      'reject_result_success',
      {},
      WebSocketServerTypes.NOTIFICATION
    );

    return rejectedRequest;
  }

  public async removeFriend(senderId: string, receiverId: string) {
    const removedRequest = await this.friendService.removeFriend(
      senderId,
      receiverId
    );

    const removedUser = await this.userService.findById(receiverId);

    await this.socketSessionService.sendToUser(
      senderId,
      'remove_result',
      { sendFrom: removedUser.displayName },
      WebSocketServerTypes.NOTIFICATION
    );
    await this.socketSessionService.sendToUser(
      receiverId,
      'remove_result_success',
      { sendFrom: removedUser.displayName },
      WebSocketServerTypes.NOTIFICATION
    );

    return removedRequest;
  }

  public async inviteFriend(
    senderId: string,
    receiverId: string,
    gameId: string
  ) {
    await this.socketSessionService.sendToUser(
      receiverId,
      'invite_game_request',
      { gameId, senderId },
      WebSocketServerTypes.NOTIFICATION
    );
  }

  public async inviteAccept(
    senderId: string,
    receiverId: string,
    gameId: string
  ) {
    const roomId = `${gameId}_${senderId}_${receiverId}_${Date.now()}`;
    await this.socketSessionService.sendToUser(
      senderId,
      'invite_game_accept',
      { gameId, roomId, friendId: receiverId },
      WebSocketServerTypes.NOTIFICATION
    );
    await this.socketSessionService.sendToUser(
      receiverId,
      'invite_game_accept',
      { gameId, roomId, friendId: senderId },
      WebSocketServerTypes.NOTIFICATION
    );
  }

  public async inviteReject(senderId: string, receiverId: string) {
    await this.socketSessionService.sendToUser(
      receiverId,
      'invite_game_reject',
      {},
      WebSocketServerTypes.NOTIFICATION
    );
  }

  public async inviteExpired(senderId: string, receiverId: string) {
    await this.socketSessionService.sendToUser(
      senderId,
      'invite_game_expired',
      {},
      WebSocketServerTypes.NOTIFICATION
    );
    await this.socketSessionService.sendToUser(
      receiverId,
      'invite_game_expired',
      {},
      WebSocketServerTypes.NOTIFICATION
    );
  }

  notifyPlayers(event: string, data: any) {
    this.socketSessionService.sendBroadcast(
      event,
      data,
      WebSocketServerTypes.NOTIFICATION
    );
  }
}
