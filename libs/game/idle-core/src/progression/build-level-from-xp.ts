import { XP_THRESHOLD_BASE } from './constants';

const FLOAT_EPSILON = 1e-9;

export function buildLevelFromXP(xp: number): number {
  return 1 + Math.floor(Math.sqrt(xp / XP_THRESHOLD_BASE) + FLOAT_EPSILON);
}
