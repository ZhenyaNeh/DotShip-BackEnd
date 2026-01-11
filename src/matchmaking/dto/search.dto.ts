import { ShipType } from '../types/ship.types';

export interface SearchDto {
  gameId: string;
  rating: number;
  ships?: ShipType[];
}
