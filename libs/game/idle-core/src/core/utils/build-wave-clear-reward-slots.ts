import type { RewardSlot, Wave } from '../../types';

/**
 * One reward slot per enemy in a cleared wave, ordinals assigned 0..n-1 in the wave's own enemy
 * order — the same canonical order `buildWaveClearRewards` sums xp over, so the two stay aligned
 * on replay.
 */
export function buildWaveClearRewardSlots(
  wave: Wave,
  difficulty: number,
): ReadonlyArray<RewardSlot> {
  return wave.enemies.map((_enemy, ordinal) => ({ context: { nodeTier: difficulty }, ordinal }));
}
