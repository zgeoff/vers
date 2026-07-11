import { expect, test } from 'bun:test';
import { CheckpointPayloadSchema } from './checkpoint-payload-schema';

test('it accepts the hashed subset with no extra fields', () => {
  const result = CheckpointPayloadSchema.safeParse({
    nextSeed: 'seed_1',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  });

  expect(result.success).toBeTrue();
});

test('it accepts extra fields beyond the hashed subset', () => {
  const result = CheckpointPayloadSchema.safeParse({
    combatLog: ['hit', 'crit'],
    nextSeed: 'seed_1',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a payload missing a hashed field', () => {
  const result = CheckpointPayloadSchema.safeParse({ nextSeed: 'seed_1', time: 12, type: 'tick' });

  expect(result.success).toBeFalse();
});
