import { createRNG } from '@vers/game-utils';
import xxhash from 'xxhash-wasm';
import type { SimulationContext } from '../types';

const hasher = await xxhash();

type Overrides = Omit<Partial<SimulationContext>, 'hasher'>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createMockSimulationContext(overrides: Overrides = {}): SimulationContext {
  const ctx: SimulationContext = {
    elapsed: 0,
    hasher,
    rng: createRNG(999_999_999),
    ...overrides,
  };

  return ctx;
}
