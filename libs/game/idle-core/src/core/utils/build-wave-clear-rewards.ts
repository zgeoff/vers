import type { ActivityRewards, Wave } from '../../types';

/**
 * Enemy xp arrives already difficulty-scaled by the encounter derivation, so the wave's rewards
 * are a plain sum — scaling again here would compound the node's difficulty.
 */
export function buildWaveClearRewards(wave: Wave): ActivityRewards {
  const xp = wave.enemies.reduce((total, enemy) => total + enemy.xp, 0);

  return { xp };
}
