import type { SimulationContext } from '../../types';

const MIN_WAVES = 3;
const MAX_WAVES = 6;

export function getRandomWaveCount(ctx: SimulationContext): number {
  return ctx.rng.getInt(MIN_WAVES, MAX_WAVES);
}
