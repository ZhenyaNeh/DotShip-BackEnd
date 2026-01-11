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

import { BattleRoyalBonusDto } from './dto/battle-royal-bonus.dto';
import { BattleRoyalMoveDto } from './dto/battle-royal-move.dto';
import { FireDto } from './dto/fire.dto';
import { StormDto } from './dto/storm.dto';
import { GameSessionService } from './game-session.service';

@WebSocketGateway({ namespace: 'game-session' })
export class GameSessionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly socketSessionService: SocketSessionService
  ) {}

  afterInit(server: Server) {
    this.socketSessionService.setWebSocketServer(
      server,
      WebSocketServerTypes.GAME_SESSION
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
        WebSocketServerTypes.GAME_SESSION
      );
      this.socketSessionService.setWebSocketServer(
        this.server,
        WebSocketServerTypes.GAME_SESSION
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
          WebSocketServerTypes.GAME_SESSION
        );
      }
    } catch (error) {
      console.error('Error in handleDisconnect:', error);
    }
  }

  @SubscribeMessage('fire')
  async processFire(socket: Socket, dto: FireDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processFire(userId, dto);
  }

  @SubscribeMessage('fire_random')
  async processFireRandom(socket: Socket, dto: FireDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processFireRandom(userId, dto);
  }

  @SubscribeMessage('broken_weapon')
  async processBrokenWeapon(socket: Socket, dto: FireDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processBrokenWeapon(userId, dto);
  }

  @SubscribeMessage('mine')
  async processMine(socket: Socket, dto: FireDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processMine(userId, dto);
  }

  @SubscribeMessage('rocket')
  async processRocket(socket: Socket, dto: FireDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processRocket(userId, dto);
  }

  @SubscribeMessage('sonar')
  async processSonar(socket: Socket, dto: FireDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processSonar(userId, dto);
  }

  @SubscribeMessage('storm')
  async processStorm(socket: Socket, dto: StormDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processStorm(userId, dto.roomId);
  }

  @SubscribeMessage('move_event_battle_royal')
  async processBattleRoyalMove(socket: Socket, dto: BattleRoyalMoveDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processBattleRoyalMove(userId, dto);
  }

  @SubscribeMessage('attack_event_battle_royal')
  async processBattleRoyalAttack(socket: Socket, dto: BattleRoyalMoveDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processBattleRoyalAttack(userId, dto);
  }

  @SubscribeMessage('set_bonus_battle_royal')
  async processGetBonus(socket: Socket, dto: BattleRoyalBonusDto) {
    const userId = socket.handshake.auth?.userId as string;
    return await this.gameSessionService.processGetBonus(userId, dto);
  }
}
