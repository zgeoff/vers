import { expect, test } from 'bun:test';
import { CheckpointBatchEntrySchema } from './checkpoint-batch-entry-schema';

test('it accepts a well-formed batch entry', () => {
  const result = CheckpointBatchEntrySchema.safeParse({
    hash: 'hash_1',
    payload: { entropySource: 'chain', nextSeed: 'seed_1', seed: 'seed_0', time: 12, type: 'tick' },
    prevHash: 'hash_0',
    version: 1,
  });

  expect(result.success).toBeTrue();
});

test('it rejects a negative version', () => {
  const result = CheckpointBatchEntrySchema.safeParse({
    hash: 'hash_1',
    payload: { entropySource: 'chain', nextSeed: 'seed_1', seed: 'seed_0', time: 12, type: 'tick' },
    prevHash: 'hash_0',
    version: -1,
  });

  expect(result.success).toBeFalse();
});
