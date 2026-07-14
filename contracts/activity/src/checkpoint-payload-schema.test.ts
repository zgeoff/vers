import { expect, test } from 'bun:test';
import { CheckpointPayloadSchema } from './checkpoint-payload-schema';

test('it accepts the hashed subset with no extra fields', () => {
  const result = CheckpointPayloadSchema.safeParse({
    chainIndex: 1,
    entropySource: 'server-key',
    nextSeed: 'seed_1',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  });

  expect(result.success).toBeTrue();
});

test('it accepts extra fields beyond the hashed subset', () => {
  const result = CheckpointPayloadSchema.safeParse({
    chainIndex: 1,
    combatLog: ['hit', 'crit'],
    entropySource: 'server-key',
    nextSeed: 'seed_1',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a payload missing a hashed field', () => {
  const result = CheckpointPayloadSchema.safeParse({
    chainIndex: 1,
    entropySource: 'server-key',
    nextSeed: 'seed_1',
    time: 12,
    type: 'tick',
  });

  expect(result.success).toBeFalse();
});

test('it rejects a payload missing the entropy-source tag', () => {
  const result = CheckpointPayloadSchema.safeParse({
    chainIndex: 1,
    nextSeed: 'seed_1',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  });

  expect(result.success).toBeFalse();
});

test('it rejects a payload missing chainIndex', () => {
  const result = CheckpointPayloadSchema.safeParse({
    entropySource: 'server-key',
    nextSeed: 'seed_1',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  });

  expect(result.success).toBeFalse();
});

test('it rejects a negative chainIndex', () => {
  const result = CheckpointPayloadSchema.safeParse({
    chainIndex: -1,
    entropySource: 'server-key',
    nextSeed: 'seed_1',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  });

  expect(result.success).toBeFalse();
});

test('it rejects an entropy-source tag outside the enum', () => {
  const result = CheckpointPayloadSchema.safeParse({
    chainIndex: 1,
    entropySource: 'chain',
    nextSeed: 'seed_1',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  });

  expect(result.success).toBeFalse();
});
