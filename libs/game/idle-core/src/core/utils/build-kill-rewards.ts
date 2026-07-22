import type { ActivityRewards, Wave } from '../../types';

/**
 * The rewards a wave's fallen enemies have earned beyond `creditedXP`, the total the caller has
 * already folded into the activity. Enemy xp arrives already difficulty-scaled by the encounter
 * derivation, so the sum is plain — scaling again here would compound the node's difficulty.
 * Re-summing the whole wave each tick rather than tracking individual deaths keeps the result
 * independent of the order enemies fall in, and of how many fall on the same tick.
 */
export function buildKillRewards(wave: Wave, creditedXP: number): ActivityRewards {
  let earned = 0;

  for (const enemy of wave.enemies) {
    if (!enemy.isAlive) {
      earned += enemy.xp;
    }
  }

  return { xp: earned - creditedXP };
}
