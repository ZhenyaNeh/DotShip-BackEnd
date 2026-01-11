import { BattleRoyalUpgradeType } from 'prisma/generated/enums';

export function generateInitialPositions() {
  const sectors = [
    { sectorX: 0, sectorY: 0, minX: 0, maxX: 9, minY: 0, maxY: 9 },
    { sectorX: 1, sectorY: 0, minX: 10, maxX: 19, minY: 0, maxY: 9 },
    { sectorX: 0, sectorY: 1, minX: 0, maxX: 9, minY: 10, maxY: 19 },
    { sectorX: 1, sectorY: 1, minX: 10, maxX: 19, minY: 10, maxY: 19 },
  ];

  const shuffledSectors = [...sectors];
  shuffleArray(shuffledSectors);

  const sector = sectors[Math.floor(Math.random() * sectors.length)];

  const offsetFromCorner = Math.floor(Math.random() * 6) + 1;

  const corner = Math.floor(Math.random() * 4);

  let x: number, y: number;

  switch (corner) {
    case 0:
      x = sector.minX + offsetFromCorner;
      y = sector.minY + offsetFromCorner;
      break;
    case 1:
      x = sector.maxX - offsetFromCorner;
      y = sector.minY + offsetFromCorner;
      break;
    case 2:
      x = sector.minX + offsetFromCorner;
      y = sector.maxY - offsetFromCorner;
      break;
    case 3:
      x = sector.maxX - offsetFromCorner;
      y = sector.maxY - offsetFromCorner;
      break;
  }

  x = Math.max(sector.minX, Math.min(sector.maxX, x));
  y = Math.max(sector.minY, Math.min(sector.maxY, y));

  return { x, y };
}

export function generatePlayerPosition(
  existingPositions: Array<{ x: number; y: number }>
) {
  const existingPlayer = existingPositions[0];
  const existingSectorX = Math.floor(existingPlayer.x / 10);
  const existingSectorY = Math.floor(existingPlayer.y / 10);

  // Выбираем противоположный сектор
  // let targetSectorX = 1 - existingSectorX; // 0 -> 1, 1 -> 0
  // let targetSectorY = 1 - existingSectorY; // 0 -> 1, 1 -> 0

  const freeSectors = [];
  for (let sx = 0; sx < 2; sx++) {
    for (let sy = 0; sy < 2; sy++) {
      if (sx !== existingSectorX || sy !== existingSectorY) {
        freeSectors.push({ sectorX: sx, sectorY: sy });
      }
    }
  }

  const targetSector =
    freeSectors[Math.floor(Math.random() * freeSectors.length)];

  const sectorMinX = targetSector.sectorX * 10;
  const sectorMaxX = sectorMinX + 9;
  const sectorMinY = targetSector.sectorY * 10;
  const sectorMaxY = sectorMinY + 9;

  const offsetFromCorner = Math.floor(Math.random() * 6) + 1; // 1-6
  const corner = Math.floor(Math.random() * 4); // 0-3

  let x: number, y: number;

  switch (corner) {
    case 0:
      x = sectorMinX + offsetFromCorner;
      y = sectorMinY + offsetFromCorner;
      break;
    case 1:
      x = sectorMaxX - offsetFromCorner;
      y = sectorMinY + offsetFromCorner;
      break;
    case 2:
      x = sectorMinX + offsetFromCorner;
      y = sectorMaxY - offsetFromCorner;
      break;
    case 3:
      x = sectorMaxX - offsetFromCorner;
      y = sectorMaxY - offsetFromCorner;
      break;
  }

  x = Math.max(sectorMinX, Math.min(sectorMaxX, x));
  y = Math.max(sectorMinY, Math.min(sectorMaxY, y));

  return { x, y };
}

export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function generateUpgrades(
  playerPositions: Array<{ x: number; y: number }>,
  fieldSize: number = 20
): Array<{ x: number; y: number; upgradeType: BattleRoyalUpgradeType }> {
  const upgrades: Array<{
    x: number;
    y: number;
    upgradeType: BattleRoyalUpgradeType;
  }> = [];

  const typeDistribution = {
    EXTRA_LIFE: 10,
    MOVEMENT_BOOST: 5,
    ATTACK_BOOST: 5,
    VISION_BOOST: 5,
  };

  const minDistanceFromEdge = 1;
  const minDistanceBetweenUpgrades = 1;
  const minDistanceFromPlayers = 2;

  const usedPositions = new Set<string>();

  for (const player of playerPositions) {
    usedPositions.add(`${player.x},${player.y}`);

    for (let dx = -minDistanceFromPlayers; dx <= minDistanceFromPlayers; dx++) {
      for (
        let dy = -minDistanceFromPlayers;
        dy <= minDistanceFromPlayers;
        dy++
      ) {
        const nx = player.x + dx;
        const ny = player.y + dy;

        if (nx >= 0 && nx < fieldSize && ny >= 0 && ny < fieldSize) {
          usedPositions.add(`${nx},${ny}`);
        }
      }
    }
  }

  const isPositionValid = (
    x: number,
    y: number,
    positions: Set<string>,
    minDistance: number
  ): boolean => {
    for (const pos of positions) {
      const [usedX, usedY] = pos.split(',').map(Number);
      const distance = Math.sqrt(
        Math.pow(x - usedX, 2) + Math.pow(y - usedY, 2)
      );
      if (distance < minDistance) {
        return false;
      }
    }
    return true;
  };

  for (const [type, count] of Object.entries(typeDistribution)) {
    for (let i = 0; i < count; i++) {
      let position: { x: number; y: number } = null;
      let isValid = false;
      let attempts = 0;
      const maxAttempts = 100;

      while (!isValid && attempts < maxAttempts) {
        position = {
          x:
            Math.floor(Math.random() * (fieldSize - 2 * minDistanceFromEdge)) +
            minDistanceFromEdge,
          y:
            Math.floor(Math.random() * (fieldSize - 2 * minDistanceFromEdge)) +
            minDistanceFromEdge,
        };

        const positionKey = `${position.x},${position.y}`;

        if (!usedPositions.has(positionKey)) {
          const validDistance = isPositionValid(
            position.x,
            position.y,
            usedPositions,
            minDistanceBetweenUpgrades
          );

          if (validDistance) {
            isValid = true;
            usedPositions.add(positionKey);
          }
        }

        attempts++;
      }

      if (isValid && position) {
        upgrades.push({
          x: position.x,
          y: position.y,
          upgradeType: type as BattleRoyalUpgradeType,
        });
      } else {
        console.warn(
          `Не удалось разместить бонус ${type} #${i + 1} после ${maxAttempts} попыток`
        );
      }
    }
  }

  if (
    upgrades.length < Object.values(typeDistribution).reduce((a, b) => a + b, 0)
  ) {
    // console.log('Пробуем альтернативное размещение бонусов...');

    const playerPositionsSet = new Set<string>();
    for (const player of playerPositions) {
      playerPositionsSet.add(`${player.x},${player.y}`);
    }

    upgrades.length = 0;
    usedPositions.clear();

    for (const pos of playerPositionsSet) {
      usedPositions.add(pos);
    }

    // const relaxedMinDistance = 1; // Минимальное расстояние 1 клетка

    for (const [type, count] of Object.entries(typeDistribution)) {
      let placed = 0;

      for (let i = 0; i < count * 2; i++) {
        if (placed >= count) break;

        const position = {
          x: Math.floor(Math.random() * fieldSize),
          y: Math.floor(Math.random() * fieldSize),
        };

        const positionKey = `${position.x},${position.y}`;

        if (!usedPositions.has(positionKey)) {
          usedPositions.add(positionKey);
          upgrades.push({
            x: position.x,
            y: position.y,
            upgradeType: type as BattleRoyalUpgradeType,
          });
          placed++;
        }
      }

      if (placed < count) {
        console.warn(
          `Удалось разместить только ${placed} из ${count} бонусов типа ${type}`
        );
      }
    }
  }

  // console.log(
  //   `Сгенерировано ${upgrades.length} бонусов на поле ${fieldSize}x${fieldSize}`
  // );
  // console.log(`Игроки: ${playerPositions.length}, позиции:`, playerPositions);

  return upgrades;
}

export function generateVisibleCells(
  playerId: string,
  centerX: number,
  centerY: number,
  visionRadius: number
) {
  const visibleCells: Array<{ playerId: string; x: number; y: number }> = [];
  const fieldSize = 20;

  const halfRadius = Math.floor(visionRadius / 2);
  const startX = Math.max(0, centerX - halfRadius);
  const endX = Math.min(fieldSize - 1, centerX + halfRadius);
  const startY = Math.max(0, centerY - halfRadius);
  const endY = Math.min(fieldSize - 1, centerY + halfRadius);

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      if (
        (startX === x && startY === y && visionRadius !== 3) ||
        (endX === x && startY === y && visionRadius !== 3) ||
        (startX === x && endY === y && visionRadius !== 3) ||
        (endX === x && endY === y && visionRadius !== 3)
      ) {
        continue;
      }
      visibleCells.push({
        playerId,
        x,
        y,
      });
    }
  }

  // console.log(
  //   `Сгенерировано ${visibleCells.length} видимых ячеек для игрока ${playerId} с центром (${centerX},${centerY})`
  // );

  return visibleCells;
}

export function checkBattleRoyalMove(
  playerX: number,
  playerY: number,
  targetX: number,
  targetY: number
): boolean {
  const distanceX = Math.abs(playerX - targetX);
  const distanceY = Math.abs(playerY - targetY);

  return (
    distanceX <= 1 &&
    distanceY <= 1 &&
    (playerX !== targetX || playerY !== targetY)
  );
}

export function checkBattleRoyalAttack(
  playerX: number,
  playerY: number,
  targetX: number,
  targetY: number,
  visibleCells: Array<{ x: number; y: number }>
): boolean {
  if (playerX === targetX && playerY === targetY) {
    return false;
  }

  const isVisible = visibleCells.some(
    cell => cell.x === targetX && cell.y === targetY
  );

  return isVisible;
}

export const calculateSafeZone = (
  x: number,
  y: number,
  fieldSize: number,
  safeZoneRadius: number
): boolean => {
  const center = fieldSize / 2;
  const halfSize = safeZoneRadius / 2;

  return (
    x >= center - halfSize &&
    x < center + halfSize &&
    y >= center - halfSize &&
    y < center + halfSize
  );
};
