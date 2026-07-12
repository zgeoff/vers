import { COMPLETION_BASE_XP } from './constants';

/**
 * Flat activity-completion XP bonus scaled by a node's difficulty multiplier.
 */
export function buildCompletionXP(difficulty: number): number {
  return Math.round(COMPLETION_BASE_XP * difficulty);
}
