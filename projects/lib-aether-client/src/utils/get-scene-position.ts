import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import type { VectorTuple } from '../types';

/**
 * convert a given x,y position to an x,y,z
 */
export function getScenePosition(position: [number, number]): VectorTuple {
  const x = position[0] * NODE_POSITION_SCALING_FACTOR;
  const y = position[1] * NODE_POSITION_SCALING_FACTOR;

  return [x, y, 0];
}
