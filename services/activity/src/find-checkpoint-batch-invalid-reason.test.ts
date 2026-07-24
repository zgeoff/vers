import { expect, test } from 'bun:test';
import { buildCheckpointHash } from '@vers/contract-activity';
import { findCheckpointBatchInvalidReason } from './find-checkpoint-batch-invalid-reason';
import type { CheckpointBatchHead } from './find-checkpoint-batch-invalid-reason';

const HEAD: CheckpointBatchHead = {
  appendedHead: 0,
  appendedTimeMs: 0,
  lastHash: 'genesis-hash',
  startChainIndex: 0,
};

function buildValidEntry(timeMs: number) {
  const payload = {
    chainIndex: 1,
    entropySource: 'server-key' as const,
    nextSeed: 'next-seed',
    seed: 'genesis-seed',
    time: timeMs,
    type: 'progress' as const,
  };

  return {
    hash: buildCheckpointHash({ ...payload, prevHash: HEAD.lastHash, version: 1 }),
    payload,
    prevHash: HEAD.lastHash,
    version: 1,
  };
}

test('it accepts a checkpoint whose time is an integer millisecond', () => {
  const reason = findCheckpointBatchInvalidReason(
    { checkpoints: [buildValidEntry(1000)], expectedHead: 0 },
    HEAD,
  );

  expect(reason).toBeUndefined();
});

test('it rejects a checkpoint whose time is fractional', () => {
  const reason = findCheckpointBatchInvalidReason(
    { checkpoints: [buildValidEntry(1000.5)], expectedHead: 0 },
    HEAD,
  );

  expect(reason).toBe('non-integer-time');
});
