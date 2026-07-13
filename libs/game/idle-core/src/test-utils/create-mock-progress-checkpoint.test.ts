import { expect, test } from 'bun:test';
import { ActivityCheckpointType } from '../types';
import { createMockProgressCheckpoint } from './create-mock-progress-checkpoint';

test('it creates a progress checkpoint with expected properties', () => {
  const checkpoint = createMockProgressCheckpoint();

  expect(checkpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: expect.toBeNumber() },
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });
});

test('it creates a progress checkpoint with custom properties', () => {
  const checkpoint = createMockProgressCheckpoint({
    nextSeed: 'seed_1',
    rewards: { xp: 15 },
    time: 12,
  });

  expect(checkpoint).toStrictEqual({
    nextSeed: 'seed_1',
    rewards: { xp: 15 },
    time: 12,
    type: ActivityCheckpointType.Progress,
  });
});
