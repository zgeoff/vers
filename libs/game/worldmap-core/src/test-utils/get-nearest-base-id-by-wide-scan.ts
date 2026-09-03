import { buildCellNode } from '../build-cell-node';
import { getBiome } from '../get-biome';
import { toHexPosition } from '../to-hex-position';

export function getNearestBaseIDByWideScan(seed: number, cx: number, cy: number): number {
  const [sceneX, sceneY] = toHexPosition(cx, cy);
  let nearestBaseID = -1;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const cellX = Math.round(cx) + dx;
      const cellY = Math.round(cy) + dy;
      const [nodeX, nodeY] = buildCellNode(seed, cellX, cellY).position;
      const distanceSq = (nodeX - sceneX) ** 2 + (nodeY - sceneY) ** 2;

      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestBaseID = getBiome(seed, cellX, cellY).baseID;
      }
    }
  }

  return nearestBaseID;
}
