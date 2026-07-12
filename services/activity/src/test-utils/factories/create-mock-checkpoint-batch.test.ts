import { expect, test } from 'bun:test';
import { buildCheckpointHash } from '@vers/contract-activity';
import { createMockCheckpointBatch } from './create-mock-checkpoint-batch';

test('it builds a single entry linking onto the given start by default', () => {
  const batch = createMockCheckpointBatch({ startPrevHash: 'hash_0', startVersion: 1 });

  expect(batch).toHaveLength(1);
  expect(batch[0]).toMatchObject({ prevHash: 'hash_0', version: 1 });
});

test('it builds a chain of the requested length with contiguous versions', () => {
  const batch = createMockCheckpointBatch({ count: 3, startPrevHash: 'hash_0', startVersion: 1 });

  expect(batch.map((entry) => entry.version)).toStrictEqual([1, 2, 3]);
});

test('it defaults chainIndex to the checkpoint version', () => {
  const batch = createMockCheckpointBatch({ count: 3, startPrevHash: 'hash_0', startVersion: 1 });

  expect(batch.map((entry) => entry.payload.chainIndex)).toStrictEqual([1, 2, 3]);
});

test('it offsets chainIndex by startChainIndex when given', () => {
  const batch = createMockCheckpointBatch({
    count: 3,
    startChainIndex: 10,
    startPrevHash: 'hash_0',
    startVersion: 1,
  });

  expect(batch.map((entry) => entry.payload.chainIndex)).toStrictEqual([11, 12, 13]);
});

test('it chains each entry onto the previous one', () => {
  const batch = createMockCheckpointBatch({ count: 3, startPrevHash: 'hash_0', startVersion: 1 });

  expect(batch[1]?.prevHash).toBe(batch[0]?.hash);
  expect(batch[2]?.prevHash).toBe(batch[1]?.hash);
});

test('it computes each hash via buildCheckpointHash', () => {
  const [entry] = createMockCheckpointBatch({ startPrevHash: 'hash_0', startVersion: 1 });

  expect(entry).toBeDefined();

  expect(entry?.hash).toBe(
    buildCheckpointHash({
      chainIndex: entry?.payload.chainIndex ?? 0,
      entropySource: entry?.payload.entropySource ?? '',
      nextSeed: entry?.payload.nextSeed ?? '',
      prevHash: entry?.prevHash ?? '',
      seed: entry?.payload.seed ?? '',
      time: entry?.payload.time ?? 0,
      type: entry?.payload.type ?? '',
      version: entry?.version ?? 0,
    }),
  );
});

test('it defaults entropySource to chain', () => {
  const [entry] = createMockCheckpointBatch({ startPrevHash: 'hash_0', startVersion: 1 });

  expect(entry?.payload.entropySource).toBe('chain');
});

test('it merges finalPayloadOverrides into only the last entry', () => {
  const batch = createMockCheckpointBatch({
    count: 2,
    finalPayloadOverrides: { rewards: { xp: 10 }, type: 'completed' },
    startPrevHash: 'hash_0',
    startVersion: 1,
  });

  expect(batch[0]?.payload).toMatchObject({ type: 'tick' });
  expect(batch[1]?.payload).toMatchObject({ rewards: { xp: 10 }, type: 'completed' });
});

test('it keeps the last entry chain-valid after the payload override', () => {
  const batch = createMockCheckpointBatch({
    finalPayloadOverrides: { rewards: { xp: 10 }, type: 'completed' },
    startPrevHash: 'hash_0',
    startVersion: 1,
  });

  const [entry] = batch;

  expect(entry?.hash).toBe(
    buildCheckpointHash({
      chainIndex: entry?.payload.chainIndex ?? 0,
      entropySource: entry?.payload.entropySource ?? '',
      nextSeed: entry?.payload.nextSeed ?? '',
      prevHash: entry?.prevHash ?? '',
      seed: entry?.payload.seed ?? '',
      time: entry?.payload.time ?? 0,
      type: entry?.payload.type ?? '',
      version: entry?.version ?? 0,
    }),
  );
});
