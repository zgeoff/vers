import { expect, test } from 'bun:test';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';
import { createStartedCheckpoint } from './create-started-checkpoint';

test('it creates a started checkpoint', () => {
  const ctx = createMockSimulationContext();
  const checkpoint = createStartedCheckpoint(ctx);

  expect(checkpoint).toStrictEqual({
    hash: expect.toBeString(),
    rewards: { xp: 0 },
    seed: ctx.rng.getState(),
    time: 0,
    type: ActivityCheckpointType.Started,
  });
});

test('it includes a hash based on checkpoint data', () => {
  const ctx = createMockSimulationContext();
  const checkpoint = createStartedCheckpoint(ctx);
  const { hash, rewards, ...hashParts } = checkpoint;

  expect(hash).toStrictEqual(hashObject(ctx.hasher, hashParts));
});
