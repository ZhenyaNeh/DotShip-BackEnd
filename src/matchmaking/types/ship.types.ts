export interface ShipCordType {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class ShipType {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  health: number;
}

export interface Cell {
  x: number;
  y: number;
}

export interface HitType {
  cell: Cell;
  hit: boolean;
}
