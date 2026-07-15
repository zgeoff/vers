import invariant from 'tiny-invariant';
import type { RewardSlotContext, Wave } from '../../types';

/**
 * One reward-slot context per enemy in a cleared wave, in the wave's own enemy order — the same
 * canonical order `buildWaveClearRewards` sums xp over, so the two stay aligned on replay. Ordinals
 * are not assigned here: checkpoint creation numbers the contexts earned since the last checkpoint,
 * keeping them 0-contiguous per checkpoint.
 */
export function buildWaveClearRewardSlots(
  wave: Wave,
  difficulty: number,
): ReadonlyArray<RewardSlotContext> {
  invariant(Number.isInteger(difficulty) && difficulty >= 1, 'nodeTier must be a positive integer');

  return wave.enemies.map(() => ({ nodeTier: difficulty }));
}
