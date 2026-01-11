import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import { SocketSession } from '@/libs/common/types/socket-session.types';

import { RedisBaseService } from './redis-base.service';
import { WebSocketServerTypes } from './types/web-sockets.types';

@Injectable()
export class SocketSessionService extends RedisBaseService {
  private readonly SOCKET_TTL = 60 * 60; // 1 час
  private webSocketServerMatchmaking: Server = null;
  private webSocketServerGameSession: Server = null;
  private webSocketServerNotification: Server = null;

  setWebSocketServer(server: Server, webSocketServer: WebSocketServerTypes) {
    switch (webSocketServer) {
      case WebSocketServerTypes.MATCHMAKING:
        this.webSocketServerMatchmaking = server;
        break;
      case WebSocketServerTypes.GAME_SESSION:
        this.webSocketServerGameSession = server;
        break;
      case WebSocketServerTypes.NOTIFICATION:
        this.webSocketServerNotification = server;
        break;
      default:
        Error('Error server');
        break;
    }
  }

  private socketSessionKey(
    socketId: string,
    serverType: WebSocketServerTypes
  ): string {
    return `socket:session:${serverType}:${socketId}`;
  }

  private userSocketsKey(
    userId: string,
    serverType: WebSocketServerTypes
  ): string {
    return `socket:user:${serverType}:${userId}`;
  }

  async registerSocket(
    userId: string,
    socket: Socket,
    webSocketServer: WebSocketServerTypes
  ): Promise<void> {
    this.ensureRedisConnected();
    const socketId = socket.id;
    const socketSession: SocketSession = {
      socketId,
      userId,
      connectedAt: new Date(),
    };

    const sessionKey = this.socketSessionKey(socketId, webSocketServer);
    await this.setWithExpire(sessionKey, socketSession, this.SOCKET_TTL);

    const userSocketsKey = this.userSocketsKey(userId, webSocketServer);
    await this.redisClient.sAdd(userSocketsKey, socketId);
    await this.redisClient.expire(userSocketsKey, this.SOCKET_TTL);
  }

  async unregisterSocket(
    userId: string,
    webSocketServer: WebSocketServerTypes,
    socketId?: string
  ): Promise<void> {
    try {
      this.ensureRedisConnected();
      if (!socketId) {
        const userSocketsKey = this.userSocketsKey(userId, webSocketServer);
        const socketIds = await this.redisClient.sMembers(userSocketsKey);

        for (const id of socketIds) {
          await this.redisClient.del(
            this.socketSessionKey(id, webSocketServer)
          );
        }

        await this.redisClient.del(userSocketsKey);
      } else {
        await this.redisClient.del(
          this.socketSessionKey(socketId, webSocketServer)
        );

        const userSocketsKey = this.userSocketsKey(userId, webSocketServer);
        await this.redisClient.sRem(userSocketsKey, socketId);

        const remainingSockets = await this.redisClient.sCard(userSocketsKey);
        if (remainingSockets === 0) {
          await this.redisClient.del(userSocketsKey);
        }
      }
    } catch (error) {
      console.error('Error unregistering socket:', error);
    }
  }

  async getSocketSession(
    socketId: string,
    webSocketServer: WebSocketServerTypes
  ): Promise<SocketSession | null> {
    this.ensureRedisConnected();
    const key = this.socketSessionKey(socketId, webSocketServer);
    const session = await this.redisClient.get(key);
    return session && typeof session === 'string'
      ? (JSON.parse(session) as SocketSession)
      : null;
  }

  async getUserSocketIds(
    userId: string,
    webSocketServer: WebSocketServerTypes
  ): Promise<string[]> {
    this.ensureRedisConnected();
    const key = this.userSocketsKey(userId, webSocketServer);
    return await this.redisClient.sMembers(key);
  }

  async sendToUser(
    userId: string,
    event: string,
    data: any,
    webSocketServer: WebSocketServerTypes
  ): Promise<boolean> {
    try {
      const socketIds = await this.getUserSocketIds(userId, webSocketServer);

      if (socketIds.length === 0) {
        return false;
      }

      switch (webSocketServer) {
        case WebSocketServerTypes.MATCHMAKING:
          if (!this.webSocketServerMatchmaking) {
            console.error('WebSocket matchmaking server is not initialized');
            return false;
          }
          socketIds.forEach(socketId => {
            try {
              this.webSocketServerMatchmaking.to(socketId).emit(event, data);
            } catch (error) {
              console.warn(
                `Error matchmaking sending to socket ${socketId}:`,
                error
              );
            }
          });
          break;
        case WebSocketServerTypes.GAME_SESSION:
          if (!this.webSocketServerGameSession) {
            console.error('WebSocket game session server is not initialized');
            return false;
          }
          socketIds.forEach(socketId => {
            try {
              this.webSocketServerGameSession.to(socketId).emit(event, data);
            } catch (error) {
              console.warn(
                `Error game session sending to socket ${socketId}:`,
                error
              );
            }
          });
          break;
        case WebSocketServerTypes.NOTIFICATION:
          if (!this.webSocketServerNotification) {
            console.error('WebSocket notification server is not initialized');
            return false;
          }
          socketIds.forEach(socketId => {
            try {
              this.webSocketServerNotification.to(socketId).emit(event, data);
            } catch (error) {
              console.warn(
                `Error notification sending to socket ${socketId}:`,
                error
              );
            }
          });
          break;
        default:
          Error('Error server');
          break;
      }

      return true;
    } catch (error) {
      console.error(`Error in sendToUser for user ${userId}:`, error);
      return false;
    }
  }

  sendBroadcast(
    event: string,
    data: any,
    webSocketServer: WebSocketServerTypes
  ): boolean {
    try {
      switch (webSocketServer) {
        case WebSocketServerTypes.MATCHMAKING:
          if (!this.webSocketServerMatchmaking) {
            console.error('WebSocket matchmaking server is not initialized');
            return false;
          }
          this.webSocketServerMatchmaking.emit(event, data);
          break;
        case WebSocketServerTypes.GAME_SESSION:
          if (!this.webSocketServerGameSession) {
            console.error('WebSocket game session server is not initialized');
            return false;
          }
          this.webSocketServerGameSession.emit(event, data);
          break;
        case WebSocketServerTypes.NOTIFICATION:
          if (!this.webSocketServerNotification) {
            console.error('WebSocket notification server is not initialized');
            return false;
          }
          this.webSocketServerNotification.emit(event, data);
          break;
        default:
          Error('Error server');
          break;
      }

      return true;
    } catch (error) {
      console.error(
        `Error in sendToUser for user on ${webSocketServer} server:`,
        error
      );
      return false;
    }
  }

  sendToSocket(
    socketId: string,
    event: string,
    data: any,
    webSocketServer: WebSocketServerTypes
  ) {
    try {
      switch (webSocketServer) {
        case WebSocketServerTypes.MATCHMAKING:
          if (this.webSocketServerMatchmaking) {
            this.webSocketServerMatchmaking.to(socketId).emit(event, data);
            return true;
          }
          break;
        case WebSocketServerTypes.GAME_SESSION:
          if (this.webSocketServerGameSession) {
            this.webSocketServerGameSession.to(socketId).emit(event, data);
            return true;
          }
          break;
        case WebSocketServerTypes.NOTIFICATION:
          if (this.webSocketServerNotification) {
            this.webSocketServerNotification.to(socketId).emit(event, data);
            return true;
          }
          break;
        default:
          Error('Error server');
          break;
      }

      return false;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error sending to socket ${socketId}: ${error.message}`);
      } else {
        console.error('Error sending to socket ${socketId}:', error);
      }
      return false;
    }
  }

  // broadcastToRoom(
  //   roomId: string,
  //   event: string,
  //   data: any,
  //   excludeSocketId?: string
  // ) {
  //   try {
  //     if (this.webSocketServer) {
  //       if (excludeSocketId) {
  //         this.webSocketServer
  //           .to(roomId)
  //           .except(excludeSocketId)
  //           .emit(event, data);
  //       } else {
  //         this.webSocketServer.to(roomId).emit(event, data);
  //       }
  //       return true;
  //     }
  //     return false;
  //   } catch (error) {
  //     if (error instanceof Error) {
  //       console.error(`Error broadcasting to room ${roomId}: ${error.message}`);
  //     } else {
  //       console.error(`Error broadcasting to room ${roomId}:`, error);
  //     }
  //     return false;
  //   }
  // }

  async isUserOnline(
    userId: string,
    webSocketServer: WebSocketServerTypes
  ): Promise<boolean> {
    const socketIds = await this.getUserSocketIds(userId, webSocketServer);
    return socketIds.length > 0;
  }

  async cleanupStaleSessions(webSocketServer: WebSocketServerTypes) {
    try {
      this.ensureRedisConnected();
      const pattern = 'socket:session:*';
      const keys = await this.redisClient.keys(pattern);

      let cleanedCount = 0;

      for (const key of keys) {
        const session = await this.redisClient.get(key);
        if (session && typeof session === 'string') {
          try {
            const socketSession = JSON.parse(session) as SocketSession;
            const socketId = socketSession.socketId;
            const userId = socketSession.userId;

            if (this.webSocketServerMatchmaking) {
              const socketExists =
                this.webSocketServerMatchmaking.sockets.sockets.has(socketId);

              if (!socketExists) {
                await this.unregisterSocket(userId, webSocketServer, socketId);
                cleanedCount++;
              }
            }
            if (this.webSocketServerGameSession) {
              const socketExists =
                this.webSocketServerGameSession.sockets.sockets.has(socketId);

              if (!socketExists) {
                await this.unregisterSocket(userId, webSocketServer, socketId);
                cleanedCount++;
              }
            }
          } catch {
            await this.redisClient.del(key);
            cleanedCount++;
          }
        }
      }
      return cleanedCount;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error in cleanupStaleSessions: ${error.message}`);
      } else {
        console.error(`Error in cleanupStaleSessions:`, error);
      }
      return 0;
    }
  }

  // private getCurrentWebServer(webSocketServer: WebSocketServerTypes) {
  //   switch (webSocketServer) {
  //     case WebSocketServerTypes.MATCHMAKING:
  //       return this.webSocketServerMatchmaking;
  //     case WebSocketServerTypes.GAME_SESSION:
  //       return this.webSocketServerGameSession;
  //     default:
  //       return this.webSocketServerMatchmaking;
  //   }
  // }
}
