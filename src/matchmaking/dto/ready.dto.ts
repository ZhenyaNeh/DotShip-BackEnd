import { ShipType } from '../types/ship.types';

export interface ReadyDto {
  gameId: string;
  roomId: string;
  friendId: string;
  ships: ShipType[];
}
