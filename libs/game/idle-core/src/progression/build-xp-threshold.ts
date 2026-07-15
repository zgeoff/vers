import { XP_THRESHOLD_BASE } from './constants';

/**
 * Cumulative XP required to reach a level. A placeholder quadratic curve standing in for a
 * designed one; `buildXPThreshold(1)` is always zero.
 */
export function buildXPThreshold(level: number): number {
  return XP_THRESHOLD_BASE * (level - 1) ** 2;
}
