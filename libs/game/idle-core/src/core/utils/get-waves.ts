import type { ActivityInput, SimulationContext, Wave } from '../../types';
import { createWave } from './create-wave';
import { getRandomWaveCount } from './get-random-wave-count';

const MIN_ENEMIES = 3;
const MAX_ENEMIES = 6;

interface ActivityConfig {
  readonly waveCount?: number;
  readonly waveSize?: number;
}

export function getWaves(
  activity: ActivityInput,
  ctx: SimulationContext,
  config: ActivityConfig,
): Array<Wave> {
  const waveCount = config.waveCount ?? getRandomWaveCount(ctx);

  return Array.from({ length: waveCount }, () => {
    const enemyCount = config.waveSize ?? ctx.rng.getInt(MIN_ENEMIES, MAX_ENEMIES);

    return createWave(activity, ctx, enemyCount);
  });
}
