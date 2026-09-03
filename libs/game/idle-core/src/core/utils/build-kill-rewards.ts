import type { ActivityRewards, Wave } from '../../types';

export function buildKillRewards(wave: Wave, creditedXP: number): ActivityRewards {
  let earned = 0;

  for (const enemy of wave.enemies) {
    if (!enemy.isAlive) {
      earned += enemy.xp;
    }
  }

  return { xp: earned - creditedXP };
}
