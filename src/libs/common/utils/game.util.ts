import { Move, MoveResult, Ship } from 'prisma/generated/client';

import { Cell } from '@/matchmaking/types/ship.types';

import { ShipCord } from '../types/ship.types';

export function outOfBounds(x, y): boolean {
  return x < 0 || y < 0 || x > 9 || y > 9;
}

export function shipOverlaps(ship1: Ship | ShipCord, ship2: Ship | ShipCord) {
  const ship1EndX = ship1.x + ship1.h + 1;
  const ship1EndY = ship1.y + ship1.w + 1;
  const ship2EndX = ship2.x + ship2.h + 1;
  const ship2EndY = ship2.y + ship2.w + 1;

  const noOverlap =
    ship1EndX < ship2.x ||
    ship1.x > ship2EndX ||
    ship1EndY < ship2.y ||
    ship1.y > ship2EndY;

  return !noOverlap;
}

export function shipFireHit(ship: Ship, x: number, y: number): boolean {
  const shipEndX = ship.x + ship.h;
  const shipEndY = ship.y + ship.w;

  if (x >= ship.x && x <= shipEndX && y >= ship.y && y <= shipEndY) {
    return true; // Попадание
  }

  return false; // Промах
}

export function generateUniqueMove(existingMoves: Move[]) {
  const size = 10;
  const totalCells = size * size;

  if (existingMoves.length >= totalCells) {
    return null;
  }

  const usedCells = new Set<string>();
  existingMoves.forEach(move => {
    usedCells.add(`${move.x},${move.y}`);
  });

  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);

    if (!usedCells.has(`${x},${y}`)) {
      return { x, y };
    }

    attempts++;
  }

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (!usedCells.has(`${x},${y}`)) {
        return { x, y };
      }
    }
  }

  return null;
}

export function getSurroundingCells(ship: Ship, existingMoves?: Move[]) {
  const { x, y, w, h } = ship;
  const minX = Math.max(0, x - 1);
  const minY = Math.max(0, y - 1);
  const maxX = Math.min(9, x + h + 1);
  const maxY = Math.min(9, y + w + 1);

  const surroundingCells: Partial<Pick<Move, 'x' | 'y' | 'result'>>[] = [];

  for (let i = minX; i <= maxX; i++) {
    for (let j = minY; j <= maxY; j++) {
      if (!outOfBounds(i, j) && !shipFireHit(ship, i, j)) {
        if (existingMoves) {
          const moveExists = existingMoves.some(
            move => move.x === i && move.y === j
          );
          if (!moveExists) {
            surroundingCells.push({ x: i, y: j, result: MoveResult.MISS });
          }
        } else {
          surroundingCells.push({ x: i, y: j, result: MoveResult.MISS });
        }
      }
    }
  }

  return surroundingCells;
}

export function getShipZoneCells(ship: Ship) {
  const { x, y, w, h } = ship;
  const minX = Math.max(0, x - 1);
  const minY = Math.max(0, y - 1);
  const maxX = Math.min(9, x + h + 1);
  const maxY = Math.min(9, y + w + 1);

  const surroundingCells: Partial<Pick<Move, 'x' | 'y' | 'result'>>[] = [];

  for (let i = minX; i <= maxX; i++) {
    for (let j = minY; j <= maxY; j++) {
      if (!shipFireHit(ship, i, j)) {
        surroundingCells.push({ x: i, y: j, result: MoveResult.MISS });
        continue;
      }

      surroundingCells.push({ x: i, y: j, result: MoveResult.HIT });
    }
  }

  return surroundingCells;
}

export function getRandomCellAround(x: number, y: number): Cell {
  if (Math.random() > 0.75) {
    return { x, y };
  }

  const minX = Math.max(0, x - 1);
  const minY = Math.max(0, y - 1);
  const maxX = Math.min(9, x + 1);
  const maxY = Math.min(9, y + 1);

  const randomX = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
  const randomY = Math.floor(Math.random() * (maxY - minY + 1)) + minY;

  return { x: randomX, y: randomY };
}

export function getRocketShotCells(
  centerX: number,
  centerY: number,
  opponentBoard: Ship[]
) {
  const cells: Partial<Pick<Move, 'x' | 'y' | 'result'>>[] = [];

  const directions = [
    [0, -1],
    [0, 1],
    [0, 0],
    [-1, 0],
    [1, 0],
  ];

  for (const [dx, dy] of directions) {
    const x = centerX + dx;
    const y = centerY + dy;

    if (!outOfBounds(x, y)) {
      const hasShip = opponentBoard.find(ship => shipFireHit(ship, x, y));

      if (hasShip) {
        cells.push({ x, y, result: MoveResult.HIT });
      } else {
        cells.push({ x, y, result: MoveResult.MISS });
      }
    }
  }

  return cells;
}

export function getSonarZoneCells(
  centerX: number,
  centerY: number,
  opponentBoard: Ship[]
) {
  const cells: Partial<Pick<Move, 'x' | 'y' | 'result'>>[] = [];

  const newX = Math.max(1, Math.min(8, centerX));
  const newY = Math.max(1, Math.min(8, centerY));

  const startX = Math.max(0, newX - 1);
  const endX = Math.min(9, newX + 1);
  const startY = Math.max(0, newY - 1);
  const endY = Math.min(9, newY + 1);

  // Добавляем все клетки в зоне
  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      const hasShip = opponentBoard.find(ship => shipFireHit(ship, x, y));

      if (hasShip) {
        cells.push({ x, y, result: MoveResult.HIT });
      } else {
        cells.push({ x, y, result: MoveResult.MISS });
      }
    }
  }

  return cells;
}

export function stormEventChanges(userShips: Ship[], opponentMove: Move[]) {
  const userDestroyedShips = userShips.filter(ship => ship.health === 0);

  const cellsNearDestroyedShips: Partial<Pick<Move, 'x' | 'y' | 'result'>>[] =
    [];

  for (const ship of userDestroyedShips) {
    cellsNearDestroyedShips.push(...getSurroundingCells(ship));
  }

  const existingHits = new Set(
    cellsNearDestroyedShips.map(hit => `${hit.x},${hit.y}`)
  );

  const resultOpponentMove = opponentMove.filter(move => {
    return (
      move.result === MoveResult.HIT ||
      move.result === MoveResult.SUNK ||
      existingHits.has(`${move.x},${move.y}`)
    );
  });

  const directions = [
    { dx: 0, dy: -1 }, // вверх
    { dx: 0, dy: 1 }, // вниз
    { dx: -1, dy: 0 }, // влево
    { dx: 1, dy: 0 }, // вправо
  ];

  const resultUserShips: Ship[] = userShips;

  const movedShips = new Set<number>();

  for (const ship of resultUserShips) {
    if (ship.health !== ship.maxHealth || movedShips.has(ship.shipId)) continue;

    const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);

    for (const dir of shuffledDirs) {
      const newX = ship.x + dir.dx;
      const newY = ship.y + dir.dy;

      if (
        outOfBounds(newX, newY) ||
        outOfBounds(newX + ship.h, newY + ship.w)
      ) {
        continue;
      }

      const tempShip = {
        ...ship,
        x: newX,
        y: newY,
      };

      const overlaps = resultUserShips.some(other => {
        if (other.id === ship.id) return false;
        return shipOverlaps(tempShip, other);
      });

      if (!overlaps) {
        ship.x = newX;
        ship.y = newY;
        movedShips.add(ship.shipId);
        break;
      }
    }
  }

  return { resultUserShips, resultOpponentMove };
}
