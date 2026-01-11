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

import { ReadyDto } from './dto/ready.dto';
import { SearchDto } from './dto/search.dto';
import { MatchmakingService } from './matchmaking.service';

@WebSocketGateway({ namespace: 'matchmaking' })
export class MatchmakingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly socketSessionService: SocketSessionService
  ) {}

  afterInit(server: Server) {
    this.socketSessionService.setWebSocketServer(
      server,
      WebSocketServerTypes.MATCHMAKING
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
        WebSocketServerTypes.MATCHMAKING
      );
      this.socketSessionService.setWebSocketServer(
        this.server,
        WebSocketServerTypes.MATCHMAKING
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
          WebSocketServerTypes.MATCHMAKING
        );
        await this.matchmakingService.handleUserDisconnect(userId);
      }
    } catch (error) {
      console.error('Error in handleDisconnect:', error);
    }
  }

  @SubscribeMessage('search')
  async searchMatch(socket: Socket, dto: SearchDto) {
    try {
      const userId = socket.handshake.auth.userId as string;
      return await this.matchmakingService.searchMatch(userId, dto);
    } catch (error) {
      console.error('Error in searchMatch:', error);
      socket.emit('matchmaking_error', {
        message: 'Failed to search for match',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  @SubscribeMessage('cancel_search')
  async cancelSearch(socket: Socket, data: { gameId: string }) {
    try {
      const userId = socket.handshake.auth?.userId as string;
      return await this.matchmakingService.cancelSearch(data.gameId, userId);
    } catch (error) {
      console.error('Error in cancelSearch:', error);
      socket.emit('matchmaking_error', {
        message: 'Failed to cancel search',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  @SubscribeMessage('ready_player')
  async playerReady(socket: Socket, dto: ReadyDto) {
    try {
      const userId = socket.handshake.auth.userId as string;
      return await this.matchmakingService.playerReady(userId, dto);
    } catch (error) {
      console.error('Error in searchMatch:', error);
      socket.emit('matchmaking_error', {
        message: 'Failed to ready up player',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
  @SubscribeMessage('cancel_ready')
  async cancelReady(socket: Socket, dto: ReadyDto) {
    try {
      const userId = socket.handshake.auth.userId as string;
      return await this.matchmakingService.cancelReady(userId, dto);
    } catch (error) {
      console.error('Error in searchMatch:', error);
      socket.emit('matchmaking_error', {
        message: 'Failed to ready up player',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
