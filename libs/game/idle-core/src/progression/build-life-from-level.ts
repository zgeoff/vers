import { LIFE_BASE, LIFE_PER_LEVEL } from './constants';

export function buildLifeFromLevel(level: number): number {
  return LIFE_BASE + LIFE_PER_LEVEL * (level - 1);
}
