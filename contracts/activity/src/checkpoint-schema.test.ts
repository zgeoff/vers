import { expect, test } from 'bun:test';
import { CheckpointSchema } from './checkpoint-schema';

test('it accepts a well-formed checkpoint', () => {
  const result = CheckpointSchema.safeParse({
    appendedAt: new Date(),
    hash: 'hash_1',
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'seed_1',
      seed: 'seed_0',
      time: 12,
      type: 'tick',
    },
    prevHash: 'hash_0',
    version: 1,
  });

  expect(result.success).toBeTrue();
});

test('it rejects a checkpoint missing appendedAt', () => {
  const result = CheckpointSchema.safeParse({
    hash: 'hash_1',
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'seed_1',
      seed: 'seed_0',
      time: 12,
      type: 'tick',
    },
    prevHash: 'hash_0',
    version: 1,
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['appendedAt'] }),
  );
});
