import { GameMode, MoveResult, RoomPrivacy } from 'prisma/generated/enums';

export interface PlayerGameState {
  user: {
    id: string;
    email: string;
    displayName: string;
    picture?: string;
    rating?: number;
  };
  ships: Array<{
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    health: number;
  }>;
  moves: Array<{
    x: number;
    y: number;
    result: MoveResult;
  }>;
  ratingHistory?: {
    oldRating: number;
    newRating: number;
    ratingChange: number;
  };
}

export interface GameStateResponse {
  player_user: PlayerGameState;
  player_opponent: PlayerGameState;
  playerTurn: string;
  winner_id?: string;
  room: {
    id: string;
    privacy: RoomPrivacy;
    gameMode: GameMode;
  };
}
