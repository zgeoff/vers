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

function setupTest(
  config: Readonly<{ scheduleFlush?: (flush: () => Promise<void>) => void }> = {},
) {
  const link = new RPCLink({ url: `${ACTIVITY_SERVICE_URL}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);
  const onInvalid = mock<(activityID: string, reason: string) => void>();
  const submitter = createCheckpointSubmitter({ client, onInvalid, ...config });

  return { onInvalid, submitter };
}

test('it flushes immediately on a terminal checkpoint and confirms the queue on success', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 2 };
    }),
  );

  await ctx.submitter.attach({
    activityID: 'success-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('success-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('success-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledExactlyOnceWith({
    activityID: 'success-activity',
    checkpoints: expect.toBeArrayOfSize(2),
    expectedHead: 0,
  });

  const remaining = await readQueuedCheckpoints('success-activity');

  expect(remaining).toStrictEqual([]);
});

test('it trims the queue to the CONFLICT appendedHead and resends the tail', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      if (track.mock.calls.length === 1) {
        throw opts.errors.CONFLICT({ data: { appendedHead: 2 } });
      }

      return { appendedHead: 3 };
    }),
  );

  await ctx.submitter.attach({
    activityID: 'conflict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('conflict-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('conflict-activity', createMockProgressCheckpoint());
  await ctx.submitter.submit('conflict-activity', createMockCompletedCheckpoint());

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
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);
      throw opts.errors.CHECKPOINT_INVALID({ data: { reason: 'broken-chain-link' } });
    }),
  );

  await ctx.submitter.attach({
    activityID: 'invalid-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('invalid-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('invalid-activity', createMockCompletedCheckpoint());

  expect(ctx.onInvalid).toHaveBeenCalledExactlyOnceWith('invalid-activity', 'broken-chain-link');
  expect(track).toHaveBeenCalledOnce();

  const remaining = await readQueuedCheckpoints('invalid-activity');

  expect(remaining).toHaveLength(2);

  // a checkpoint produced after the stream stopped is silently dropped, not queued
  await ctx.submitter.submit('invalid-activity', createMockProgressCheckpoint());

  const stillTwo = await readQueuedCheckpoints('invalid-activity');

  expect(stillTwo).toHaveLength(2);
});

test('it discards the queue on NOT_FOUND', async () => {
  const ctx = setupTest();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      throw opts.errors.NOT_FOUND({ data: {} });
    }),
  );

  await ctx.submitter.attach({
    activityID: 'not-found-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('not-found-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('not-found-activity', createMockCompletedCheckpoint());

  const remaining = await readQueuedCheckpoints('not-found-activity');

  expect(remaining).toStrictEqual([]);
});

test('it holds the queue on UNAUTHORIZED and resends on the next flush', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      if (track.mock.calls.length === 1) {
        throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
      }

      return { appendedHead: 3 };
    }),
  );

  await ctx.submitter.attach({
    activityID: 'unauthorized-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('unauthorized-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('unauthorized-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  const stillQueued = await readQueuedCheckpoints('unauthorized-activity');

  expect(stillQueued).toHaveLength(2);

  await ctx.submitter.submit('unauthorized-activity', createMockCompletedCheckpoint());

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
  await writeQueuedCheckpoint(
    'resume-activity',
    createMockCheckpointBatchEntry({ hash: 'resumed_hash_1', version: 1 }),
  );

  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.attach({
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

  const ctx = setupTest({
    scheduleFlush: (flush) => {
      capturedFlush = flush;
    },
  });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.attach({
    activityID: 'progress-window-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('progress-window-activity', createMockStartedCheckpoint());

  expect(track).not.toHaveBeenCalled();
  expect(capturedFlush).toBeDefined();

  await capturedFlush?.();

  expect(track).toHaveBeenCalledOnce();
});
