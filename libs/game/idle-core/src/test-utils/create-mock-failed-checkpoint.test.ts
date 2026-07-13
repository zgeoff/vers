import { expect, test } from 'bun:test';
import { ActivityCheckpointType } from '../types';
import { createMockFailedCheckpoint } from './create-mock-failed-checkpoint';

test('it creates a failed checkpoint with expected properties', () => {
  const checkpoint = createMockFailedCheckpoint();

  expect(checkpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: expect.toBeNumber() },
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Failed,
  });
});

test('it creates a failed checkpoint with custom properties', () => {
  const checkpoint = createMockFailedCheckpoint({
    nextSeed: 'seed_3',
    rewards: { xp: -5 },
    time: 30,
  });

  expect(checkpoint).toStrictEqual({
    nextSeed: 'seed_3',
    rewards: { xp: -5 },
    time: 30,
    type: ActivityCheckpointType.Failed,
  });
});
