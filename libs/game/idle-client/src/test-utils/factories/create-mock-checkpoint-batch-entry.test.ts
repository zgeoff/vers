import { expect, test } from 'bun:test';
import { createMockCheckpointBatchEntry } from './create-mock-checkpoint-batch-entry';

test('it creates a checkpoint batch entry with expected properties', () => {
  const entry = createMockCheckpointBatchEntry();

  expect(entry).toStrictEqual({
    hash: expect.toBeString(),
    payload: {
      chainIndex: expect.toBeNumber(),
      entropySource: 'server-key',
      nextSeed: expect.toBeString(),
      seed: expect.toBeString(),
      time: expect.toBeNumber(),
      type: 'progress',
    },
    prevHash: expect.toBeString(),
    version: expect.toBeNumber(),
  });
});

test('it creates a checkpoint batch entry with custom properties', () => {
  const entry = createMockCheckpointBatchEntry({
    hash: 'hash_5',
    payload: { chainIndex: 5, type: 'completed' },
    prevHash: 'hash_4',
    version: 5,
  });

  expect(entry).toMatchObject({
    hash: 'hash_5',
    payload: { chainIndex: 5, entropySource: 'server-key', type: 'completed' },
    prevHash: 'hash_4',
    version: 5,
  });
});
