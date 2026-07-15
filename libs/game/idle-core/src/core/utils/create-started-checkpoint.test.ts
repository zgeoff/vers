import { expect, test } from 'bun:test';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { ActivityCheckpointType } from '../../types';
import { createStartedCheckpoint } from './create-started-checkpoint';

test('it creates a started checkpoint', () => {
  const ctx = createMockSimulationContext();
  const checkpoint = createStartedCheckpoint(ctx);

  expect(checkpoint).toStrictEqual({
    nextSeed: ctx.rng.getState(),
    rewards: { xp: 0 },
    rewardSlots: [],
    seed: ctx.rng.getState(),
    time: 0,
    type: ActivityCheckpointType.Started,
  });
});

test('it sets nextSeed to the same value as seed, since Started consumes nothing', () => {
  const ctx = createMockSimulationContext();
  const checkpoint = createStartedCheckpoint(ctx);

  expect(checkpoint.nextSeed).toBe(checkpoint.seed);
});
