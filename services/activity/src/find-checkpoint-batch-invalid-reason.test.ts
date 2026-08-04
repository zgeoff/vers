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

interface BuildEntryConfig {
  readonly chainIndex: number;
  readonly prevHash: string;
  readonly time: number;
  readonly type?: string;
  readonly version: number;
}

function buildEntry(config: Readonly<BuildEntryConfig>) {
  const payload = {
    chainIndex: config.chainIndex,
    entropySource: 'server-key' as const,
    nextSeed: 'next-seed',
    seed: 'genesis-seed',
    time: config.time,
    type: config.type ?? 'progress',
  };

  return {
    hash: buildCheckpointHash({ ...payload, prevHash: config.prevHash, version: config.version }),
    payload,
    prevHash: config.prevHash,
    version: config.version,
  };
}

test('it accepts a checkpoint whose time is an integer millisecond', () => {
  const reason = findCheckpointBatchInvalidReason(
    {
      checkpoints: [buildEntry({ chainIndex: 1, prevHash: HEAD.lastHash, time: 1000, version: 1 })],
      expectedHead: 0,
    },
    HEAD,
  );

  expect(reason).toBeUndefined();
});

test('it accepts a contiguous multi-checkpoint batch', () => {
  const first = buildEntry({ chainIndex: 1, prevHash: HEAD.lastHash, time: 1000, version: 1 });
  const second = buildEntry({ chainIndex: 2, prevHash: first.hash, time: 2000, version: 2 });

  const reason = findCheckpointBatchInvalidReason(
    { checkpoints: [first, second], expectedHead: 0 },
    HEAD,
  );

  expect(reason).toBeUndefined();
});

test('it rejects a checkpoint whose version is not contiguous from the head', () => {
  const reason = findCheckpointBatchInvalidReason(
    {
      checkpoints: [buildEntry({ chainIndex: 2, prevHash: HEAD.lastHash, time: 1000, version: 2 })],
      expectedHead: 0,
    },
    HEAD,
  );

  expect(reason).toBe('non-contiguous-versions');
});

test('it rejects a checkpoint whose chain index does not follow the head', () => {
  const reason = findCheckpointBatchInvalidReason(
    {
      checkpoints: [buildEntry({ chainIndex: 2, prevHash: HEAD.lastHash, time: 1000, version: 1 })],
      expectedHead: 0,
    },
    HEAD,
  );

  expect(reason).toBe('non-contiguous-chain-index');
});

test('it rejects a terminal checkpoint before the batch ends', () => {
  const first = buildEntry({
    chainIndex: 1,
    prevHash: HEAD.lastHash,
    time: 1000,
    type: 'completed',
    version: 1,
  });

  const second = buildEntry({ chainIndex: 2, prevHash: first.hash, time: 2000, version: 2 });

  const reason = findCheckpointBatchInvalidReason(
    { checkpoints: [first, second], expectedHead: 0 },
    HEAD,
  );

  expect(reason).toBe('terminal-not-last');
});

test('it rejects a checkpoint whose reward slots are not contiguous from zero', () => {
  const base = buildEntry({ chainIndex: 1, prevHash: HEAD.lastHash, time: 1000, version: 1 });

  const entry = {
    ...base,
    payload: { ...base.payload, rewardSlots: [{ context: { nodeTier: 1 }, ordinal: 3 }] },
  };

  const reason = findCheckpointBatchInvalidReason({ checkpoints: [entry], expectedHead: 0 }, HEAD);

  expect(reason).toBe('invalid-reward-slots');
});

test('it rejects a checkpoint whose reward xp does not fit a postgres integer', () => {
  const base = buildEntry({ chainIndex: 1, prevHash: HEAD.lastHash, time: 1000, version: 1 });
  const entry = { ...base, payload: { ...base.payload, rewards: { xp: 1.5 } } };
  const reason = findCheckpointBatchInvalidReason({ checkpoints: [entry], expectedHead: 0 }, HEAD);

  expect(reason).toBe('invalid-rewards');
});

test('it rejects a checkpoint whose time is fractional', () => {
  const reason = findCheckpointBatchInvalidReason(
    {
      checkpoints: [
        buildEntry({ chainIndex: 1, prevHash: HEAD.lastHash, time: 1000.5, version: 1 }),
      ],
      expectedHead: 0,
    },
    HEAD,
  );

  expect(reason).toBe('non-integer-time');
});

test('it rejects a checkpoint whose time regresses within the batch', () => {
  const first = buildEntry({ chainIndex: 1, prevHash: HEAD.lastHash, time: 2000, version: 1 });
  const second = buildEntry({ chainIndex: 2, prevHash: first.hash, time: 1000, version: 2 });

  const reason = findCheckpointBatchInvalidReason(
    { checkpoints: [first, second], expectedHead: 0 },
    HEAD,
  );

  expect(reason).toBe('time-regression');
});

test('it rejects a first checkpoint that does not link onto the head hash', () => {
  const reason = findCheckpointBatchInvalidReason(
    {
      checkpoints: [
        buildEntry({ chainIndex: 1, prevHash: 'unlinked-hash', time: 1000, version: 1 }),
      ],
      expectedHead: 0,
    },
    HEAD,
  );

  expect(reason).toBe('broken-chain-link');
});

test('it rejects a checkpoint whose hash does not match its payload', () => {
  const entry = {
    ...buildEntry({ chainIndex: 1, prevHash: HEAD.lastHash, time: 1000, version: 1 }),
    hash: 'not-the-real-hash',
  };

  const reason = findCheckpointBatchInvalidReason({ checkpoints: [entry], expectedHead: 0 }, HEAD);

  expect(reason).toBe('hash-mismatch');
});
