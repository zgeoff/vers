import { XP_THRESHOLD_BASE } from './constants';

export function buildXPThreshold(level: number): number {
  return XP_THRESHOLD_BASE * (level - 1) ** 2;
}
