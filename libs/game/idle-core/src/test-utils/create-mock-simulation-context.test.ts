import { expect, test } from 'bun:test';
import { createRNG, stateFromSeed } from '@vers/game-utils';
import { createMockSimulationContext } from './create-mock-simulation-context';

test('it creates a simulation context with expected properties', () => {
  const ctx = createMockSimulationContext();

  expect(ctx).toStrictEqual({
    elapsed: 0,
    hasher: expect.toBeObject(),
    rng: expect.toBeObject(),
  });
});

test('it creates a simulation context with custom properties', () => {
  const rng = createRNG(stateFromSeed(999_999_999));

  const ctx = createMockSimulationContext({
    elapsed: 100,
    rng,
  });

  expect(ctx).toStrictEqual({
    elapsed: 100,
    hasher: expect.toBeObject(),
    rng,
  });
});
