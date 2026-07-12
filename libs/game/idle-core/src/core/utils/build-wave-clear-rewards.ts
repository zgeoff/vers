import { buildKillXP } from '../../progression';
import type { ActivityRewards, Wave } from '../../types';

export function buildWaveClearRewards(wave: Wave, difficulty: number): ActivityRewards {
  const xp = wave.enemies.reduce((total, enemy) => total + buildKillXP(enemy, difficulty), 0);

  return { xp };
}
