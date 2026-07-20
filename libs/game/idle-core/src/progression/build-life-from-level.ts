import { LIFE_BASE, LIFE_PER_LEVEL } from './constants';

/**
 * Maximum life for an avatar at a level — a placeholder linear curve standing in for a designed
 * one.
 */
export function buildLifeFromLevel(level: number): number {
  return LIFE_BASE + LIFE_PER_LEVEL * (level - 1);
}
