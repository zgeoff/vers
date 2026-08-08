import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { pickCheckpointBatchRaceOutcome } from './pick-checkpoint-batch-race-outcome';
import type { CheckpointBatchRaceRow } from './pick-checkpoint-batch-race-outcome';
import { createMockCheckpointBatch } from './test-utils/factories/create-mock-checkpoint-batch';

test('it reports not-found when the row is gone', () => {
  const outcome = pickCheckpointBatchRaceOutcome('session-a', undefined, []);

  expect(outcome).toStrictEqual({ kind: 'not-found' });
});

test('it reports session-evicted when another session owns the writer', () => {
  const current: CheckpointBatchRaceRow = {
    appendedHead: 3,
    lastHash: 'tail-hash',
    status: 'active',
    writerSessionId: 'session-b',
  };

  const outcome = pickCheckpointBatchRaceOutcome('session-a', current, []);

  expect(outcome).toStrictEqual({ kind: 'session-evicted' });
});

test('it reports a retryable conflict when the active head is simply stale', () => {
  const current: CheckpointBatchRaceRow = {
    appendedHead: 3,
    lastHash: 'tail-hash',
    status: 'active',
    writerSessionId: null,
  };

  const outcome = pickCheckpointBatchRaceOutcome('session-a', current, []);

  expect(outcome).toStrictEqual({ appendedHead: 3, kind: 'conflict' });
});

test('it settles a resubmit whose replay recomputes onto the terminal tail', () => {
  const checkpoints = createMockCheckpointBatch({ startPrevHash: 'genesis-hash', startVersion: 3 });
  const tail = checkpoints.at(-1);

  invariant(tail !== undefined, 'the factory always builds at least one checkpoint');

  const current: CheckpointBatchRaceRow = {
    appendedHead: tail.version,
    lastHash: tail.hash,
    status: 'stopped',
    writerSessionId: null,
  };

  const outcome = pickCheckpointBatchRaceOutcome('session-a', current, checkpoints);

  expect(outcome).toStrictEqual({ appendedHead: tail.version, kind: 'resubmit-settled' });
});

test('it reports terminal when a replay does not recompute onto the terminal tail', () => {
  const checkpoints = createMockCheckpointBatch({ startPrevHash: 'genesis-hash', startVersion: 3 });
  const tail = checkpoints.at(-1);

  invariant(tail !== undefined, 'the factory always builds at least one checkpoint');

  const current: CheckpointBatchRaceRow = {
    appendedHead: tail.version,
    lastHash: 'a-different-tail-hash',
    status: 'stopped',
    writerSessionId: null,
  };

  const outcome = pickCheckpointBatchRaceOutcome('session-a', current, checkpoints);

  expect(outcome).toStrictEqual({
    appendedHead: tail.version,
    kind: 'terminal',
    status: 'stopped',
  });
});
