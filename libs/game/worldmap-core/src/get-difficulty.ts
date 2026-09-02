import { DIFFICULTY_STEP, MAX_DIFFICULTY, ORIGIN_CELL } from './consts';
import { getHexDistance } from './get-hex-distance';

export function getDifficulty(cx: number, cy: number): number {
  const rings = Math.floor(getHexDistance([cx, cy], ORIGIN_CELL) / DIFFICULTY_STEP);

  return Math.min(Math.max(rings, 0), MAX_DIFFICULTY);
}
