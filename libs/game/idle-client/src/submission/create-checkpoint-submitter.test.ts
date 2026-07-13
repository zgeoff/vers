import { expect, mock, onTestFinished, test } from 'bun:test';
import { ORPCError } from '@orpc/client';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';
import { PROGRESS_FLUSH_INTERVAL_MS } from './constants';
import { createCheckpointSubmitter } from './create-checkpoint-submitter';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import type { ActivityServiceClient } from './types';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

const startedCheckpoint: ActivityCheckpoint = {
  nextSeed: 'seed_0',
  rewards: { xp: 0 },
  seed: 'seed_0',
  time: 0,
  type: ActivityCheckpointType.Started,
};

const progressCheckpoint: ActivityCheckpoint = {
  nextSeed: 'seed_1',
  rewards: { xp: 5 },
  time: 12,
  type: ActivityCheckpointType.Progress,
};

const completedCheckpoint: ActivityCheckpoint = {
  nextSeed: 'seed_2',
  rewards: { xp: 20 },
  time: 24,
  type: ActivityCheckpointType.Completed,
};

function buildClient(
  trackActivityProgress: ActivityServiceClient['trackActivityProgress'],
): Pick<ActivityServiceClient, 'trackActivityProgress'> {
  return { trackActivityProgress };
}

function buildOnInvalid() {
  return mock<(activityID: string, reason: string) => void>();
}

test('it flushes immediately on a terminal checkpoint and confirms the queue on success', async () => {
  const trackActivityProgress = mock(() => Promise.resolve({ appendedHead: 2 }));
  const client = buildClient(trackActivityProgress);
  const submitter = createCheckpointSubmitter({ client, onInvalid: buildOnInvalid() });

  await submitter.attach({
    activityID: 'success-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('success-activity', startedCheckpoint);
  await submitter.submit('success-activity', completedCheckpoint);

  expect(trackActivityProgress).toHaveBeenCalledOnce();

  expect(trackActivityProgress).toHaveBeenCalledWith({
    activityID: 'success-activity',
    checkpoints: expect.toBeArrayOfSize(2),
    expectedHead: 0,
  });

  const remaining = await readQueuedCheckpoints('success-activity');

  expect(remaining).toStrictEqual([]);
});

test('it trims the queue to the CONFLICT appendedHead and resends the tail', async () => {
  const trackActivityProgress = mock(() => Promise.resolve({ appendedHead: 3 }));
  const client = buildClient(trackActivityProgress);
  const submitter = createCheckpointSubmitter({ client, onInvalid: buildOnInvalid() });

  await submitter.attach({
    activityID: 'conflict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  trackActivityProgress.mockImplementationOnce(() =>
    Promise.reject(new ORPCError('CONFLICT', { data: { appendedHead: 2 }, defined: true })),
  );

  await submitter.submit('conflict-activity', startedCheckpoint);
  await submitter.submit('conflict-activity', progressCheckpoint);
  await submitter.submit('conflict-activity', completedCheckpoint);

  expect(trackActivityProgress).toHaveBeenCalledTimes(2);

  expect(trackActivityProgress).toHaveBeenLastCalledWith({
    activityID: 'conflict-activity',
    checkpoints: [expect.objectContaining({ version: 3 })],
    expectedHead: 2,
  });

  const remaining = await readQueuedCheckpoints('conflict-activity');

  expect(remaining).toStrictEqual([]);
});

test('it stops the stream and keeps queued rows on CHECKPOINT_INVALID', async () => {
  const trackActivityProgress = mock(() =>
    Promise.reject(
      new ORPCError('CHECKPOINT_INVALID', { data: { reason: 'broken-chain-link' }, defined: true }),
    ),
  );

  const client = buildClient(trackActivityProgress);
  const onInvalid = buildOnInvalid();
  const submitter = createCheckpointSubmitter({ client, onInvalid });

  await submitter.attach({
    activityID: 'invalid-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('invalid-activity', startedCheckpoint);
  await submitter.submit('invalid-activity', completedCheckpoint);

  expect(onInvalid).toHaveBeenCalledExactlyOnceWith('invalid-activity', 'broken-chain-link');
  expect(trackActivityProgress).toHaveBeenCalledOnce();

  const remaining = await readQueuedCheckpoints('invalid-activity');

  expect(remaining).toHaveLength(2);

  // a checkpoint produced after the stream stopped is silently dropped, not queued
  await submitter.submit('invalid-activity', progressCheckpoint);

  const stillTwo = await readQueuedCheckpoints('invalid-activity');

  expect(stillTwo).toHaveLength(2);
});

test('it discards the queue on NOT_FOUND', async () => {
  const trackActivityProgress = mock(() =>
    Promise.reject(new ORPCError('NOT_FOUND', { data: {}, defined: true })),
  );

  const client = buildClient(trackActivityProgress);
  const submitter = createCheckpointSubmitter({ client, onInvalid: buildOnInvalid() });

  await submitter.attach({
    activityID: 'not-found-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('not-found-activity', startedCheckpoint);
  await submitter.submit('not-found-activity', completedCheckpoint);

  const remaining = await readQueuedCheckpoints('not-found-activity');

  expect(remaining).toStrictEqual([]);
});

test('it holds the queue on UNAUTHORIZED and resends on the next flush', async () => {
  const trackActivityProgress = mock(() => Promise.resolve({ appendedHead: 3 }));
  const client = buildClient(trackActivityProgress);
  const submitter = createCheckpointSubmitter({ client, onInvalid: buildOnInvalid() });

  await submitter.attach({
    activityID: 'unauthorized-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  trackActivityProgress.mockImplementationOnce(() =>
    Promise.reject(
      new ORPCError('UNAUTHORIZED', { data: { reason: 'missing-session' }, defined: true }),
    ),
  );

  await submitter.submit('unauthorized-activity', startedCheckpoint);
  await submitter.submit('unauthorized-activity', completedCheckpoint);

  expect(trackActivityProgress).toHaveBeenCalledOnce();

  const stillQueued = await readQueuedCheckpoints('unauthorized-activity');

  expect(stillQueued).toHaveLength(2);

  await submitter.submit('unauthorized-activity', completedCheckpoint);

  expect(trackActivityProgress).toHaveBeenCalledTimes(2);

  expect(trackActivityProgress).toHaveBeenLastCalledWith({
    activityID: 'unauthorized-activity',
    checkpoints: expect.toBeArrayOfSize(3),
    expectedHead: 0,
  });

  const remaining = await readQueuedCheckpoints('unauthorized-activity');

  expect(remaining).toStrictEqual([]);
});

test('it resends rows already queued from a previous worker lifetime on attach', async () => {
  await writeQueuedCheckpoint('resume-activity', {
    hash: 'resumed_hash_1',
    payload: {
      chainIndex: 1,
      entropySource: 'chain',
      nextSeed: 'resumed_seed_1',
      seed: 'resumed_seed_0',
      time: 0,
      type: 'started',
    },
    prevHash: 'start_hash',
    version: 1,
  });

  const trackActivityProgress = mock(() => Promise.resolve({ appendedHead: 1 }));
  const client = buildClient(trackActivityProgress);
  const submitter = createCheckpointSubmitter({ client, onInvalid: buildOnInvalid() });

  await submitter.attach({
    activityID: 'resume-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  expect(trackActivityProgress).toHaveBeenCalledExactlyOnceWith({
    activityID: 'resume-activity',
    checkpoints: [expect.objectContaining({ hash: 'resumed_hash_1', version: 1 })],
    expectedHead: 0,
  });

  const remaining = await readQueuedCheckpoints('resume-activity');

  expect(remaining).toStrictEqual([]);
});

test('it defers a non-terminal checkpoint to the shared progress window', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  let capturedCallback: (() => void) | undefined;
  let capturedDelay: number | undefined;

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a deliberately narrowed test double standing in for the global's own overloaded signature
  globalThis.setTimeout = ((callback: () => void, delay?: number) => {
    if (delay === PROGRESS_FLUSH_INTERVAL_MS) {
      capturedCallback = callback;
      capturedDelay = delay;

      return originalSetTimeout(() => {
        //
      }, 0);
    }

    return originalSetTimeout(callback, delay);
  }) as typeof setTimeout;

  onTestFinished(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  const trackActivityProgress = mock(() => Promise.resolve({ appendedHead: 1 }));
  const client = buildClient(trackActivityProgress);
  const submitter = createCheckpointSubmitter({ client, onInvalid: buildOnInvalid() });

  await submitter.attach({
    activityID: 'progress-window-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('progress-window-activity', startedCheckpoint);

  expect(trackActivityProgress).not.toHaveBeenCalled();
  expect(capturedDelay).toBe(PROGRESS_FLUSH_INTERVAL_MS);
  capturedCallback?.();

  await new Promise((resolve) => {
    originalSetTimeout(resolve, 0);
  });

  expect(trackActivityProgress).toHaveBeenCalledOnce();
});
