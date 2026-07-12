import { FAILURE_XP_LOSS_FRACTION } from './constants';
import { levelForXP } from './level-for-xp';
import { xpThreshold } from './xp-threshold';

/**
 * XP lost on activity failure: a fraction of an avatar's progress into its current level, clamped
 * so the loss never crosses that level's threshold — a level already reached is never lost.
 */
export function buildFailureXPLoss(runningXP: number): number {
  const level = levelForXP(runningXP);
  const floor = xpThreshold(level);
  const progressIntoLevel = runningXP - floor;
  const rawLoss = Math.round(progressIntoLevel * FAILURE_XP_LOSS_FRACTION);

  return Math.min(rawLoss, progressIntoLevel);
}
