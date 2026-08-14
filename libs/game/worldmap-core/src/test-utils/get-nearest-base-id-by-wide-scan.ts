import { buildCellNode } from '../build-cell-node';
import { getBiome } from '../get-biome';
import { toHexPosition } from '../to-hex-position';

/**
 * Brute-force oracle for the biome field's nearest-node territory lookup: scans a 7×7 cell box
 * around an axial position and returns the base biome id of the nearest jittered node. Wider than
 * the field's own 3×3 scan on purpose, so a test comparing the two catches any jitter increase that
 * would push the true nearest node outside the 3×3 box.
 */
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
