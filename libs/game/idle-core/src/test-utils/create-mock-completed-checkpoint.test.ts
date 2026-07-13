import { expect, test } from 'bun:test';
import { ActivityCheckpointType } from '../types';
import { createMockCompletedCheckpoint } from './create-mock-completed-checkpoint';

test('it creates a completed checkpoint with expected properties', () => {
  const checkpoint = createMockCompletedCheckpoint();

  expect(checkpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: expect.toBeNumber() },
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Completed,
  });
});

test('it creates a completed checkpoint with custom properties', () => {
  const checkpoint = createMockCompletedCheckpoint({
    nextSeed: 'seed_2',
    rewards: { xp: 20 },
    time: 24,
  });

  expect(checkpoint).toStrictEqual({
    nextSeed: 'seed_2',
    rewards: { xp: 20 },
    time: 24,
    type: ActivityCheckpointType.Completed,
  });
});
