import { createRNG } from '@vers/game-utils';
import { expect, test } from 'vitest';
import { createMockSimulationContext } from './create-mock-simulation-context';

test('it creates a simulation context with expected properties', () => {
  const ctx = createMockSimulationContext();

  expect(ctx).toStrictEqual({
    elapsed: 0,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    hasher: expect.any(Object),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    rng: expect.any(Object),
  });
});

test('it creates a simulation context with custom properties', () => {
  const rng = createRNG(999_999_999);

  const ctx = createMockSimulationContext({
    elapsed: 100,
    rng,
  });

  expect(ctx).toStrictEqual({
    elapsed: 100,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    hasher: expect.any(Object),
    rng,
  });
});
