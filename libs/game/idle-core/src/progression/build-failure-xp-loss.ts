import { buildLevelFromXP } from './build-level-from-xp';
import { buildXPThreshold } from './build-xp-threshold';
import { FAILURE_XP_LOSS_FRACTION } from './constants';

export function buildFailureXPLoss(runningXP: number): number {
  const level = buildLevelFromXP(runningXP);
  const floor = buildXPThreshold(level);
  const progressIntoLevel = runningXP - floor;
  const rawLoss = Math.round(progressIntoLevel * FAILURE_XP_LOSS_FRACTION);

  return Math.min(rawLoss, progressIntoLevel);
}
