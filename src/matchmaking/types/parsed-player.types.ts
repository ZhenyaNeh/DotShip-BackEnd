import { ShipType } from './ship.types';

export interface ParsedPlayer {
  userId: string;
  rating: number;
  ships: ShipType[];
}
