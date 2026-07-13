import { buildStateFromSeed, createRNG } from '@vers/game-utils';
import type { SimulationContext } from '../types';

export function createMockSimulationContext(
  overrides: Partial<SimulationContext> = {},
): SimulationContext {
  const ctx: SimulationContext = {
    elapsed: 0,
    rng: createRNG(buildStateFromSeed(999_999_999)),
    ...overrides,
  };

  return ctx;
}
