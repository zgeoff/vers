import { expect, test } from 'bun:test';
import { ActivityCheckpointSchema } from './activity-checkpoint-schema';

test('it accepts a started checkpoint carrying its seed', () => {
  const result = ActivityCheckpointSchema.safeParse({
    nextSeed: 'b',
    rewards: { xp: 0 },
    seed: 'a',
    time: 0,
    type: 'started',
  });

  expect(result.success).toBeTrue();
});

test('it accepts a progress checkpoint with a level up', () => {
  const result = ActivityCheckpointSchema.safeParse({
    levelUp: { from: 1, to: 2 },
    nextSeed: 'c',
    rewards: { xp: 60 },
    time: 33_800,
    type: 'progress',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a non-started checkpoint carrying a seed', () => {
  const result = ActivityCheckpointSchema.safeParse({
    nextSeed: 'c',
    rewards: { xp: 0 },
    seed: 'a',
    time: 0,
    type: 'failed',
  });

  expect(result.success).toBeFalse();
});

test('it rejects a type outside the union', () => {
  const result = ActivityCheckpointSchema.safeParse({
    nextSeed: 'c',
    rewards: { xp: 0 },
    time: 0,
    type: 'paused',
  });

  expect(result.success).toBeFalse();
});
