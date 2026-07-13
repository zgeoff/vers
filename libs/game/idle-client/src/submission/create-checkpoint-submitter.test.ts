import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { ACTIVITY_SERVICE_URL, mockActivityService } from '../mocks/mock-activity-service';
import { server } from '../mocks/node';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockCompletedCheckpoint } from '../test-utils/factories/create-mock-completed-checkpoint';
import { createMockProgressCheckpoint } from '../test-utils/factories/create-mock-progress-checkpoint';
import { createMockStartedCheckpoint } from '../test-utils/factories/create-mock-started-checkpoint';
import { createCheckpointSubmitter } from './create-checkpoint-submitter';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import type { ActivityServiceClient } from './types';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

type TrackProgressOutput = Awaited<ReturnType<ActivityServiceClient['trackActivityProgress']>>;

type TrackProgressHandler = Parameters<typeof mockActivityService.trackActivityProgress.handler>[0];

type TrackProgressCall = Extract<TrackProgressHandler, (args: never) => unknown>;

type TrackProgressErrors = Parameters<TrackProgressCall>[0]['errors'];

type TrackResponder = (errors: TrackProgressErrors, callCount: number) => TrackProgressOutput;

function buildActivityClient(): ActivityServiceClient {
  const link = new RPCLink({ url: `${ACTIVITY_SERVICE_URL}/rpc` });

  return createORPCClient(link);
}

/**
 * Registers an MSW handler for the one procedure the submitter calls and returns a spy recording
 * each request's input. `respond` computes the reply per call — returning the fresh head, or
 * throwing one of the contract's own typed errors keyed off the call count.
 */
function registerTrackHandler(respond: TrackResponder) {
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return respond(opts.errors, track.mock.calls.length);
    }),
  );

  return track;
}

function buildOnInvalid() {
  return mock<(activityID: string, reason: string) => void>();
}

test('it flushes immediately on a terminal checkpoint and confirms the queue on success', async () => {
  const track = registerTrackHandler(() => ({ appendedHead: 2 }));

  const submitter = createCheckpointSubmitter({
    client: buildActivityClient(),
    onInvalid: buildOnInvalid(),
  });

  await submitter.attach({
    activityID: 'success-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('success-activity', createMockStartedCheckpoint());
  await submitter.submit('success-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  expect(track).toHaveBeenCalledWith({
    activityID: 'success-activity',
    checkpoints: expect.toBeArrayOfSize(2),
    expectedHead: 0,
  });

  const remaining = await readQueuedCheckpoints('success-activity');

  expect(remaining).toStrictEqual([]);
});

test('it trims the queue to the CONFLICT appendedHead and resends the tail', async () => {
  const track = registerTrackHandler((errors, callCount) => {
    if (callCount === 1) {
      throw errors.CONFLICT({ data: { appendedHead: 2 } });
    }

    return { appendedHead: 3 };
  });

  const submitter = createCheckpointSubmitter({
    client: buildActivityClient(),
    onInvalid: buildOnInvalid(),
  });

  await submitter.attach({
    activityID: 'conflict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('conflict-activity', createMockStartedCheckpoint());
  await submitter.submit('conflict-activity', createMockProgressCheckpoint());
  await submitter.submit('conflict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledTimes(2);

  expect(track).toHaveBeenLastCalledWith({
    activityID: 'conflict-activity',
    checkpoints: [expect.objectContaining({ version: 3 })],
    expectedHead: 2,
  });

  const remaining = await readQueuedCheckpoints('conflict-activity');

  expect(remaining).toStrictEqual([]);
});

test('it stops the stream and keeps queued rows on CHECKPOINT_INVALID', async () => {
  const track = registerTrackHandler((errors) => {
    throw errors.CHECKPOINT_INVALID({ data: { reason: 'broken-chain-link' } });
  });

  const onInvalid = buildOnInvalid();
  const submitter = createCheckpointSubmitter({ client: buildActivityClient(), onInvalid });

  await submitter.attach({
    activityID: 'invalid-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('invalid-activity', createMockStartedCheckpoint());
  await submitter.submit('invalid-activity', createMockCompletedCheckpoint());

  expect(onInvalid).toHaveBeenCalledExactlyOnceWith('invalid-activity', 'broken-chain-link');
  expect(track).toHaveBeenCalledOnce();

  const remaining = await readQueuedCheckpoints('invalid-activity');

  expect(remaining).toHaveLength(2);

  // a checkpoint produced after the stream stopped is silently dropped, not queued
  await submitter.submit('invalid-activity', createMockProgressCheckpoint());

  const stillTwo = await readQueuedCheckpoints('invalid-activity');

  expect(stillTwo).toHaveLength(2);
});

test('it discards the queue on NOT_FOUND', async () => {
  registerTrackHandler((errors) => {
    throw errors.NOT_FOUND({ data: {} });
  });

  const submitter = createCheckpointSubmitter({
    client: buildActivityClient(),
    onInvalid: buildOnInvalid(),
  });

  await submitter.attach({
    activityID: 'not-found-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('not-found-activity', createMockStartedCheckpoint());
  await submitter.submit('not-found-activity', createMockCompletedCheckpoint());

  const remaining = await readQueuedCheckpoints('not-found-activity');

  expect(remaining).toStrictEqual([]);
});

test('it holds the queue on UNAUTHORIZED and resends on the next flush', async () => {
  const track = registerTrackHandler((errors, callCount) => {
    if (callCount === 1) {
      throw errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
    }

    return { appendedHead: 3 };
  });

  const submitter = createCheckpointSubmitter({
    client: buildActivityClient(),
    onInvalid: buildOnInvalid(),
  });

  await submitter.attach({
    activityID: 'unauthorized-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('unauthorized-activity', createMockStartedCheckpoint());
  await submitter.submit('unauthorized-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  const stillQueued = await readQueuedCheckpoints('unauthorized-activity');

  expect(stillQueued).toHaveLength(2);

  await submitter.submit('unauthorized-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledTimes(2);

  expect(track).toHaveBeenLastCalledWith({
    activityID: 'unauthorized-activity',
    checkpoints: expect.toBeArrayOfSize(3),
    expectedHead: 0,
  });

  const remaining = await readQueuedCheckpoints('unauthorized-activity');

  expect(remaining).toStrictEqual([]);
});

test('it resends rows already queued from a previous worker lifetime on attach', async () => {
  const resumedEntry = createMockCheckpointBatchEntry({ hash: 'resumed_hash_1', version: 1 });

  await writeQueuedCheckpoint('resume-activity', resumedEntry);

  const track = registerTrackHandler(() => ({ appendedHead: 1 }));

  const submitter = createCheckpointSubmitter({
    client: buildActivityClient(),
    onInvalid: buildOnInvalid(),
  });

  await submitter.attach({
    activityID: 'resume-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  expect(track).toHaveBeenCalledExactlyOnceWith({
    activityID: 'resume-activity',
    checkpoints: [expect.objectContaining({ hash: 'resumed_hash_1', version: 1 })],
    expectedHead: 0,
  });

  const remaining = await readQueuedCheckpoints('resume-activity');

  expect(remaining).toStrictEqual([]);
});

test('it defers a non-terminal checkpoint to the shared progress window', async () => {
  let capturedFlush: (() => Promise<void>) | undefined;
  const track = registerTrackHandler(() => ({ appendedHead: 1 }));

  const submitter = createCheckpointSubmitter({
    client: buildActivityClient(),
    onInvalid: buildOnInvalid(),
    scheduleFlush: (flush) => {
      capturedFlush = flush;
    },
  });

  await submitter.attach({
    activityID: 'progress-window-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await submitter.submit('progress-window-activity', createMockStartedCheckpoint());

  expect(track).not.toHaveBeenCalled();
  expect(capturedFlush).toBeDefined();

  await capturedFlush?.();

  expect(track).toHaveBeenCalledOnce();
});
