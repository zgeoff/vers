import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import type { VectorTuple } from '../types';

export function getScenePosition(position: readonly [number, number]): VectorTuple {
  const x = position[0] * NODE_POSITION_SCALING_FACTOR;
  const y = position[1] * NODE_POSITION_SCALING_FACTOR;

  return [x, y, 0];
}
