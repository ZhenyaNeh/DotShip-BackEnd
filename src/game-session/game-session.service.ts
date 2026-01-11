import { BadGatewayException, Injectable } from '@nestjs/common';
import { BattleRoyalPlayer } from 'prisma/generated/browser';
import { Move, Ship } from 'prisma/generated/client';
import { BattleRoyalUpgradeType, MoveResult } from 'prisma/generated/enums';

import { BattleRoyalRoomService } from '@/battle-royal-room/battle-royal-room.service';
import {
  checkBattleRoyalAttack,
  checkBattleRoyalMove,
} from '@/libs/common/utils/battle-royal.util';
import {
  generateUniqueMove,
  getRandomCellAround,
  getRocketShotCells,
  getSonarZoneCells,
  getSurroundingCells,
  shipFireHit,
  stormEventChanges,
} from '@/libs/common/utils/game.util';
import { SocketSessionService } from '@/redis/socket-session.service';
import { WebSocketServerTypes } from '@/redis/types/web-sockets.types';
import { RoomService } from '@/room/room.service';

import { BattleRoyalAttackDto } from './dto/battle-royal-attack.dto';
import { BattleRoyalBonusDto } from './dto/battle-royal-bonus.dto';
import { BattleRoyalMoveDto } from './dto/battle-royal-move.dto';
import { FireDto } from './dto/fire.dto';
import {
  CheckCellCollision,
  CheckUserTurn,
  IsChangeUserTurn,
} from './types/fire-execute-shot.types';

@Injectable()
export class GameSessionService {
  constructor(
    private readonly roomService: RoomService,
    private readonly battleRoyalRoomService: BattleRoyalRoomService,
    private readonly socketSessionService: SocketSessionService
  ) {}

  public async processFire(userId: string, dto: FireDto) {
    return await this.fireExecuteShot(
      userId,
      dto,
      CheckUserTurn.TRUE,
      CheckCellCollision.TRUE,
      IsChangeUserTurn.TRUE
    );
  }

  public async processFireRandom(userId: string, dto: FireDto) {
    const { user } = await this.roomService.getPlayersInRoom(
      dto.roomId,
      userId
    );

    const move = generateUniqueMove(user.moves);

    if (!move) {
      throw new BadGatewayException('No available moves left.');
    }

    return await this.fireExecuteShot(
      userId,
      { roomId: dto.roomId, x: move.x, y: move.y },
      CheckUserTurn.TRUE,
      CheckCellCollision.TRUE,
      IsChangeUserTurn.TRUE
    );
  }

  async processBrokenWeapon(userId: string, dto: FireDto) {
    const { x, y } = getRandomCellAround(dto.x, dto.y);
    return await this.fireExecuteShot(
      userId,
      { x, y, roomId: dto.roomId },
      CheckUserTurn.TRUE,
      CheckCellCollision.FALSE,
      IsChangeUserTurn.TRUE
    );
  }

  async processMine(userId: string, dto: FireDto) {
    const { user, opponent } = await this.roomService.getPlayersInRoom(
      dto.roomId,
      userId
    );

    if (Math.random() > 0.25) {
      await this.fireExecuteShot(
        opponent.user.id,
        dto,
        CheckUserTurn.FALSE,
        CheckCellCollision.FALSE,
        IsChangeUserTurn.FALSE
      );
    }
    return await this.fireExecuteShot(
      user.user.id,
      dto,
      CheckUserTurn.TRUE,
      CheckCellCollision.TRUE,
      IsChangeUserTurn.TRUE
    );
  }

  async processRocket(userId: string, dto: FireDto) {
    const { user, opponent } = await this.roomService.getPlayersInRoom(
      dto.roomId,
      userId
    );

    const isGameOver = await this.roomService.checkGameOver(dto.roomId);

    if (isGameOver) {
      await this.notifyPlayers(userId, opponent.user.id, 'game_over', {});
      return;
    }

    await this.roomService.checkPlayerTurn(dto.roomId, userId);

    const cells = getRocketShotCells(dto.x, dto.y, opponent.ships);

    const isHitShip = cells.some(cell => cell.result === MoveResult.HIT);

    const movesRocket = await this.roomService.addRocketMoves(
      user.id,
      cells,
      opponent.ships
    );
    const shipsRocket = await this.roomService.getPlayerShipsById(opponent.id);

    if (!isHitShip) {
      await this.roomService.changePlayerTurn(dto.roomId, opponent.user.id);
      await this.notifyPlayers(userId, opponent.user.id, 'change_player_turn', {
        userId: opponent.user.id,
      });
    }

    await this.socketSessionService.sendToUser(
      user.user.id,
      'rocket_result',
      {
        userId: user.user.id,
        moves: movesRocket,
        ships: shipsRocket.filter(ship => ship.health === 0),
      },
      WebSocketServerTypes.GAME_SESSION
    );
    await this.socketSessionService.sendToUser(
      opponent.user.id,
      'rocket_result',
      {
        opponentId: opponent.user.id,
        moves: movesRocket,
        ships: shipsRocket,
      },
      WebSocketServerTypes.GAME_SESSION
    );

    if (isHitShip) {
      await this.gameOverHandling(dto.roomId, user.user.id, opponent.user.id);
    }
  }

  async processSonar(userId: string, dto: FireDto) {
    const { user, opponent } = await this.roomService.getPlayersInRoom(
      dto.roomId,
      userId
    );

    await this.roomService.changePlayerTurn(dto.roomId, opponent.user.id);
    await this.notifyPlayers(userId, opponent.user.id, 'change_player_turn', {
      userId: opponent.user.id,
    });

    const cells = getSonarZoneCells(dto.x, dto.y, opponent.ships);
    await this.socketSessionService.sendToUser(
      user.user.id,
      'sonar_result',
      {
        userId: user.user.id,
        cells,
      },
      WebSocketServerTypes.GAME_SESSION
    );
  }

  async processStorm(userId: string, roomId: string) {
    const { user, opponent } = await this.roomService.getPlayersInRoom(
      roomId,
      userId
    );

    const { resultUserShips, resultOpponentMove } = stormEventChanges(
      user.ships,
      opponent.moves
    );

    await this.roomService.updatePlayersAfterStorm(
      user.id,
      opponent.id,
      resultUserShips,
      resultOpponentMove
    );

    const newUserShips = resultUserShips.map(ship => ({
      id: ship.shipId,
      x: ship.x,
      y: ship.y,
      w: ship.w,
      h: ship.h,
      health: ship.health,
    }));

    await this.socketSessionService.sendToUser(
      user.user.id,
      'storm_result',
      {
        userId: user.user.id,
        newUserShips: newUserShips,
        newOpponentMoves: resultOpponentMove,
      },
      WebSocketServerTypes.GAME_SESSION
    );
    await this.socketSessionService.sendToUser(
      opponent.user.id,
      'storm_result',
      {
        opponentId: opponent.user.id,
        newUserShips: newUserShips.filter(ship => ship.health === 0),
        newOpponentMoves: resultOpponentMove,
      },
      WebSocketServerTypes.GAME_SESSION
    );

    await this.roomService.changePlayerTurn(roomId, opponent.user.id);
    await this.notifyPlayers(userId, opponent.user.id, 'change_player_turn', {
      userId: opponent.user.id,
    });
  }

  async processBattleRoyalMove(userId: string, dto: BattleRoyalMoveDto) {
    const player = await this.battleRoyalRoomService.getPlayerInRoom(
      dto.roomId,
      userId
    );

    if (player.room.playerTurn !== player.id) {
      throw new Error("It's not your turn now");
    }

    if (player.remainingMoves <= 0) {
      throw new Error('No moves available');
    }

    if (checkBattleRoyalMove(player.x, player.y, dto.x, dto.y) === false) {
      throw new Error('The coordinates are not valid');
    }

    const cellIsEmpty = await this.battleRoyalRoomService.checkCellEmpty(
      dto.roomId,
      player.id,
      dto.x,
      dto.y
    );

    if (cellIsEmpty === false) {
      throw new Error('The cell is occupied by another player or a bonus');
    }

    await this.battleRoyalRoomService.battleRoyalMoveUpdate(
      player,
      dto.x,
      dto.y
    );

    await this.updateGameState('update_move_battle_royal', dto.roomId);
  }

  async processBattleRoyalAttack(userId: string, dto: BattleRoyalAttackDto) {
    const player = await this.battleRoyalRoomService.getPlayerInRoom(
      dto.roomId,
      userId
    );

    if (player.room.playerTurn !== player.id) {
      throw new Error("It's not your turn now");
    }

    if (player.remainingAttacks <= 0) {
      throw new Error('No attacks available');
    }

    if (
      checkBattleRoyalAttack(
        player.x,
        player.y,
        dto.x,
        dto.y,
        player.visibleCells
      ) === false
    ) {
      throw new Error('The coordinates are not valid');
    }

    const cellIsBonus = await this.battleRoyalRoomService.checkCellBonus(
      dto.roomId,
      player.id,
      dto.x,
      dto.y
    );

    if (cellIsBonus) {
      await this.socketSessionService.sendToUser(
        userId,
        'upgrade_chose_battle_royal',
        cellIsBonus,
        WebSocketServerTypes.GAME_SESSION
      );
      return;
    }

    const cellIsPlayer = await this.battleRoyalRoomService.checkCellPlayer(
      dto.roomId,
      player.id,
      dto.x,
      dto.y
    );

    if (cellIsPlayer) {
      await this.processHitOpponent(player, cellIsPlayer);
      return;
    }

    await this.battleRoyalRoomService.battleRoyalAttackUpdate(
      player,
      player.kills,
      player.damageDealt
    );
    await this.updateGameState('update_attack_battle_royal', dto.roomId);
  }

  async processGetBonus(userId: string, dto: BattleRoyalBonusDto) {
    const player = await this.battleRoyalRoomService.getPlayerInRoom(
      dto.roomId,
      userId
    );

    if (player.room.playerTurn !== player.id) {
      throw new Error("It's not your turn now");
    }

    if (player.remainingAttacks <= 0) {
      throw new Error('No attacks available');
    }

    if (dto.upgrade.upgradeType === BattleRoyalUpgradeType.EXTRA_LIFE) {
      await this.battleRoyalRoomService.battleRoyalUserExtraLive(player);
    }

    if (dto.slotIndex !== 3) {
      await this.battleRoyalRoomService.battleRoyalUserBonusUpdate(
        player.id,
        player.upgradeSlots,
        dto
      );
    }

    await this.battleRoyalRoomService.battleRoyalBonusCollected(
      player.room.id,
      player.id,
      dto
    );
    await this.battleRoyalRoomService.battleRoyalAttackUpdate(
      player,
      player.kills,
      player.damageDealt
    );

    await this.updateGameState('update_attack_bonus_battle_royal', dto.roomId);
  }

  // async processGetGameOver(roomId: string) {
  //   const gameOverData =
  //     await this.battleRoyalRoomService.getGameResults(roomId);
  //   const players =
  //     await this.battleRoyalRoomService.getAllPlayersInRoom(roomId);

  //   for (const playerNotify of players) {
  //     await this.socketSessionService.sendToUser(
  //       playerNotify.user.id,
  //       'game_over_battle_royal',
  //       gameOverData,
  //       WebSocketServerTypes.GAME_SESSION
  //     );
  //   }
  // }

  async processHitOpponent(
    attacker: BattleRoyalPlayer,
    target: BattleRoyalPlayer
  ) {
    await this.battleRoyalRoomService.battleRoyalOpponentHitUpdate(
      attacker,
      target
    );
    await this.updateGameState(
      'update_attack_player_battle_royal',
      target.roomId
    );
  }

  private async updateGameState(event: string, roomId: string) {
    const players =
      await this.battleRoyalRoomService.getAllPlayersInRoom(roomId);

    for (const playerNotify of players) {
      const playerState =
        await this.battleRoyalRoomService.getBattleRoyalGameData(
          roomId,
          playerNotify.user.id
        );
      await this.socketSessionService.sendToUser(
        playerNotify.user.id,
        event,
        playerState,
        WebSocketServerTypes.GAME_SESSION
      );
    }
  }

  private async fireExecuteShot(
    userId: string,
    dto: FireDto,
    checkUserTurn: CheckUserTurn,
    checkCellCollision: CheckCellCollision,
    isChangeUserTurn: IsChangeUserTurn
  ) {
    const { user, opponent } = await this.roomService.getPlayersInRoom(
      dto.roomId,
      userId
    );
    if (checkUserTurn === CheckUserTurn.TRUE) {
      await this.roomService.checkPlayerTurn(dto.roomId, userId);
    }
    const isGameOver = await this.roomService.checkGameOver(dto.roomId);

    if (isGameOver) {
      await this.notifyPlayers(userId, opponent.user.id, 'game_over', {});
      return;
    }

    const existingMove = user.moves.find(
      move => move.x === dto.x && move.y === dto.y
    );

    if (existingMove && checkCellCollision === CheckCellCollision.TRUE) {
      throw new BadGatewayException("You've already shot at this cell.");
    }

    const hitShip = opponent.ships.find(ship =>
      shipFireHit(ship, dto.x, dto.y)
    );

    if (!hitShip) {
      return await this.missHandling(
        user.user.id,
        opponent.user.id,
        user.id,
        dto,
        isChangeUserTurn
      );
    }

    const move = await this.hitHandling(
      user.user.id,
      opponent.user.id,
      user.id,
      dto,
      hitShip,
      user.moves
    );

    await this.gameOverHandling(dto.roomId, user.user.id, opponent.user.id);

    return move;
  }

  private async missHandling(
    userId: string,
    opponentId: string,
    userPlayerId: string,
    dto: FireDto,
    isChangeUserTurn: IsChangeUserTurn
  ) {
    const move = await this.roomService.addPlayerMove(
      userPlayerId,
      dto.x,
      dto.y,
      MoveResult.MISS
    );

    await this.notifyPlayers(userId, opponentId, 'fire_result', {
      userId,
      move,
    });

    if (isChangeUserTurn === IsChangeUserTurn.TRUE) {
      await this.roomService.changePlayerTurn(dto.roomId, opponentId);

      await this.notifyPlayers(userId, opponentId, 'change_player_turn', {
        userId: opponentId,
      });
    }

    return move;
  }

  private async hitHandling(
    userId: string,
    opponentId: string,
    userPlayerId: string,
    dto: FireDto,
    hitShip: Ship,
    userMoves: Move[]
  ) {
    const updatedShip = await this.roomService.hitShip(hitShip);

    const move = await this.roomService.addPlayerMove(
      userPlayerId,
      dto.x,
      dto.y,
      updatedShip.health ? MoveResult.HIT : MoveResult.SUNK
    );

    if (move.result === MoveResult.HIT) {
      await this.notifyPlayers(userId, opponentId, 'fire_result', {
        userId,
        move,
      });
      return move;
    }

    const surroundingCells = getSurroundingCells(hitShip, userMoves);
    const movesBatch = await this.roomService.addMoves(
      userPlayerId,
      surroundingCells
    );

    await this.notifyPlayers(userId, opponentId, 'sunk_ship', {
      userId,
      moves: movesBatch,
      ship: {
        id: hitShip.shipId,
        x: hitShip.x,
        y: hitShip.y,
        w: hitShip.w,
        h: hitShip.h,
        health: hitShip.health,
      },
    });

    return move;
  }

  private async gameOverHandling(
    roomId: string,
    userId: string,
    opponentId: string
  ) {
    const isGameOver = await this.roomService.updateGameResults(roomId, userId);

    if (isGameOver) {
      await this.notifyPlayers(userId, opponentId, 'game_over', {});
    }
  }

  private async notifyPlayers(
    userId: string,
    opponentId: string,
    event: string,
    data: any
  ) {
    await Promise.all([
      this.socketSessionService.sendToUser(
        userId,
        event,
        data,
        WebSocketServerTypes.GAME_SESSION
      ),
      this.socketSessionService.sendToUser(
        opponentId,
        event,
        data,
        WebSocketServerTypes.GAME_SESSION
      ),
    ]);
  }
}
