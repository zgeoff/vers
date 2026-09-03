import { COMPLETION_BASE_XP } from './constants';

export function buildCompletionXP(difficulty: number): number {
  return Math.round(COMPLETION_BASE_XP * difficulty);
}
