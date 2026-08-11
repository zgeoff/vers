import type { Viewport } from '@vers/worldmap-core';
import { HEX_SIZE, WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';
import type { PerspectiveCamera } from 'three';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import invariant from 'tiny-invariant';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';

const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);

const NDC_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/**
 * Extra cell of margin folded into every side, absorbing per-avatar jitter and the rounding a
 * fractional cell at the frustum's edge takes.
 */
const CELL_PADDING = 1;
const HEX_ROW_SPACING = HEX_SIZE * 1.5;
const HEX_COLUMN_SPACING = HEX_SIZE * Math.sqrt(3);

/**
 * Projects `camera`'s frustum corners onto the world's ground plane and converts the resulting
 * footprint to a cell-coordinate viewport, padded by one cell and clamped to the lattice's
 * encodable range. Every corner ray is expected to reach the ground — true for any camera holding
 * the locked isometric tilt, the only shape this is ever called with; a camera pointed away from
 * the ground is a broken invariant elsewhere, not input this function itself validates.
 */
export function buildViewportFromCamera(camera: PerspectiveCamera): Viewport {
  const raycaster = new Raycaster();
  const hitPoint = new Vector3();

  let minCX = Infinity;
  let maxCX = -Infinity;
  let minCY = Infinity;
  let maxCY = -Infinity;

  for (const [ndcX, ndcY] of NDC_CORNERS) {
    raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);

    const hit = raycaster.ray.intersectPlane(GROUND_PLANE, hitPoint);

    invariant(hit, 'camera frustum corner ray never reaches the ground plane');

    const hexX = hit.x / NODE_POSITION_SCALING_FACTOR;
    const hexY = -hit.z / NODE_POSITION_SCALING_FACTOR;
    const cy = hexY / HEX_ROW_SPACING;
    const cx = hexX / HEX_COLUMN_SPACING - cy / 2;

    minCX = Math.min(minCX, cx);
    maxCX = Math.max(maxCX, cx);
    minCY = Math.min(minCY, cy);
    maxCY = Math.max(maxCY, cy);
  }

  return {
    maxCX: Math.min(WORLD_COORD_MAX, Math.ceil(maxCX) + CELL_PADDING),
    maxCY: Math.min(WORLD_COORD_MAX, Math.ceil(maxCY) + CELL_PADDING),
    minCX: Math.max(WORLD_COORD_MIN, Math.floor(minCX) - CELL_PADDING),
    minCY: Math.max(WORLD_COORD_MIN, Math.floor(minCY) - CELL_PADDING),
  };
}
