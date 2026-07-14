import { expect, test } from 'bun:test';
import { ActivityCheckpointType } from '../../types';
import { createMockStartedCheckpoint } from './create-mock-started-checkpoint';

test('it creates a started checkpoint with expected properties', () => {
  const checkpoint = createMockStartedCheckpoint();

  expect(checkpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 0 },
    seed: expect.toBeString(),
    time: 0,
    type: ActivityCheckpointType.Started,
  });

  expect(checkpoint.nextSeed).toBe(checkpoint.seed);
});

test('it creates a started checkpoint with custom properties', () => {
  const checkpoint = createMockStartedCheckpoint({ nextSeed: 'seed_9', seed: 'seed_0', time: 5 });

  expect(checkpoint).toStrictEqual({
    nextSeed: 'seed_9',
    rewards: { xp: 0 },
    seed: 'seed_0',
    time: 5,
    type: ActivityCheckpointType.Started,
  });
});
