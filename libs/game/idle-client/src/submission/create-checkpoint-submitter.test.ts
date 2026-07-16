import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import { http } from 'msw';
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
  const link = new RPCLink<{ traceparent?: string }>({
    headers: (options) =>
      options.context?.traceparent === undefined
        ? {}
        : { traceparent: options.context.traceparent },
    url: `${resolveServiceURL('activity')}/rpc`,
  });

  const client: ActivityServiceClient = createORPCClient(link);
  const onAcked = mock<(activityID: string, appendedHead: number) => void>();
  const onCapped = mock<(activityID: string, appendedHead: number) => void>();
  const onFlushStalled = mock<(activityID: string, reason: string, traceID: string) => void>();
  const onInvalid = mock<(activityID: string, reason: string, traceID?: string) => void>();

  const submitter = createCheckpointSubmitter({
    client,
    onAcked,
    onCapped,
    onFlushStalled,
    onInvalid,
    ...config,
  });

  return { client, onAcked, onCapped, onFlushStalled, onInvalid, submitter };
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

  await ctx.submitter.registerActivity({
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

  await ctx.submitter.registerActivity({
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

  await ctx.submitter.registerActivity({
    activityID: 'invalid-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('invalid-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('invalid-activity', createMockCompletedCheckpoint());

  expect(ctx.onInvalid).toHaveBeenCalledExactlyOnceWith(
    'invalid-activity',
    'broken-chain-link',
    expect.stringMatching(/^[0-9a-f]{32}$/),
  );

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

  await ctx.submitter.registerActivity({
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

  await ctx.submitter.registerActivity({
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

  await ctx.submitter.registerActivity({
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

  await ctx.submitter.registerActivity({
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

test('it reports each acknowledged head after a successful flush', async () => {
  const ctx = setupTest();

  server.use(mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 2 })));

  await ctx.submitter.registerActivity({
    activityID: 'acked-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('acked-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('acked-activity', createMockCompletedCheckpoint());

  expect(ctx.onAcked).toHaveBeenCalledExactlyOnceWith('acked-activity', 2);
});

test('it stops the stream, discards the queue, and reports the stop index when the server caps the batch', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);
      throw opts.errors.ACTIVITY_CAPPED({ data: { appendedHead: 0 } });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'capped-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('capped-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('capped-activity', createMockCompletedCheckpoint());

  expect(ctx.onCapped).toHaveBeenCalledExactlyOnceWith('capped-activity', 0);
  expect(track).toHaveBeenCalledOnce();

  const remaining = await readQueuedCheckpoints('capped-activity');

  expect(remaining).toStrictEqual([]);

  // a checkpoint produced after the stream stopped is silently dropped, not queued
  await ctx.submitter.submit('capped-activity', createMockProgressCheckpoint());

  const stillEmpty = await readQueuedCheckpoints('capped-activity');

  expect(stillEmpty).toStrictEqual([]);
});

test('it discards the queue and stops the stream on a stopped terminal status', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);
      throw opts.errors.ACTIVITY_TERMINAL({ data: { appendedHead: 3, status: 'stopped' } });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'terminal-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('terminal-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('terminal-activity', createMockCompletedCheckpoint());

  expect(ctx.onCapped).not.toHaveBeenCalled();
  expect(track).toHaveBeenCalledOnce();

  const remaining = await readQueuedCheckpoints('terminal-activity');

  expect(remaining).toStrictEqual([]);
});

test('it reports the stop index when a resend answers with the already-capped status', async () => {
  const ctx = setupTest();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      throw opts.errors.ACTIVITY_TERMINAL({ data: { appendedHead: 4, status: 'capped' } });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'already-capped-activity',
    appendedHead: 4,
    lastHash: 'head_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('already-capped-activity', createMockCompletedCheckpoint());

  expect(ctx.onCapped).toHaveBeenCalledExactlyOnceWith('already-capped-activity', 4);
});

test('it discards the queue and stops the stream on SESSION_EVICTED', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);
      throw opts.errors.SESSION_EVICTED({ data: {} });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'evicted-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('evicted-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('evicted-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  const remaining = await readQueuedCheckpoints('evicted-activity');

  expect(remaining).toStrictEqual([]);

  // a checkpoint produced after the stream stopped is silently dropped, not queued
  await ctx.submitter.submit('evicted-activity', createMockProgressCheckpoint());

  const stillEmpty = await readQueuedCheckpoints('evicted-activity');

  expect(stillEmpty).toStrictEqual([]);
});

test('it seeds a checkpoint submitted during registration from the queued cursor', async () => {
  await writeQueuedCheckpoint(
    'race-activity',
    createMockCheckpointBatchEntry({ hash: 'queued_hash', version: 5 }),
  );

  const ctx = setupTest({ scheduleFlush: () => {} });

  server.use(mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 5 })));

  // deliberately not awaited: the submit lands while the seed read is still in flight
  const registration = ctx.submitter.registerActivity({
    activityID: 'race-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('race-activity', createMockProgressCheckpoint());

  await registration;

  const remaining = await readQueuedCheckpoints('race-activity');

  expect(remaining).toHaveLength(1);
  expect(remaining).toPartiallyContain({ prevHash: 'queued_hash', version: 6 });
});

test('it seeds a registration that arrives while another is already loading', async () => {
  await writeQueuedCheckpoint(
    'shared-seed-activity',
    createMockCheckpointBatchEntry({ hash: 'queued_hash', version: 5 }),
  );

  const ctx = setupTest({ scheduleFlush: () => {} });

  server.use(mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 5 })));

  const first = ctx.submitter.registerActivity({
    activityID: 'shared-seed-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  // awaiting only the overlapping registration must still leave the cursor fully seeded
  await ctx.submitter.registerActivity({
    activityID: 'shared-seed-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('shared-seed-activity', createMockProgressCheckpoint());

  await first;

  const remaining = await readQueuedCheckpoints('shared-seed-activity');

  expect(remaining).toHaveLength(1);
  expect(remaining).toPartiallyContain({ prevHash: 'queued_hash', version: 6 });
});

test('it drops a checkpoint for an activity that was never registered', async () => {
  const ctx = setupTest({ scheduleFlush: () => {} });

  await ctx.submitter.submit('unregistered-activity', createMockProgressCheckpoint());

  const remaining = await readQueuedCheckpoints('unregistered-activity');

  expect(remaining).toStrictEqual([]);
});

test('it resolves each submit with the activity-relative version it assigned', async () => {
  const ctx = setupTest();

  await ctx.submitter.registerActivity({
    activityID: 'versioned-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  const firstVersion = await ctx.submitter.submit(
    'versioned-activity',
    createMockStartedCheckpoint(),
  );

  const secondVersion = await ctx.submitter.submit(
    'versioned-activity',
    createMockProgressCheckpoint(),
  );

  expect(firstVersion).toBe(1);
  expect(secondVersion).toBe(2);
});

test('it resolves with undefined for a checkpoint dropped by an unattached activity', async () => {
  const ctx = setupTest();

  const version = await ctx.submitter.submit('never-registered', createMockStartedCheckpoint());

  expect(version).toBeUndefined();
});

test('it reports a stall once after repeated unanswered flushes and keeps the queue', async () => {
  const ctx = setupTest();

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      throw new Error('backend unreachable');
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'stalled-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('stalled-activity', createMockCompletedCheckpoint());
  await ctx.submitter.submit('stalled-activity', createMockCompletedCheckpoint());

  expect(ctx.onFlushStalled).not.toHaveBeenCalled();

  await ctx.submitter.submit('stalled-activity', createMockCompletedCheckpoint());

  expect(ctx.onFlushStalled).toHaveBeenCalledExactlyOnceWith(
    'stalled-activity',
    expect.toInclude('INTERNAL_SERVER_ERROR'),
    expect.stringMatching(/^[0-9a-f]{32}$/),
  );

  // the streak keeps failing past the threshold without a second report
  await ctx.submitter.submit('stalled-activity', createMockCompletedCheckpoint());

  expect(ctx.onFlushStalled).toHaveBeenCalledOnce();

  const remaining = await readQueuedCheckpoints('stalled-activity');

  expect(remaining).toHaveLength(4);
});

test('it resets the stall streak once a flush is answered', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      if (track.mock.calls.length === 3) {
        throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
      }

      throw new Error('backend unreachable');
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'recovering-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  // two unanswered flushes, an answered one, then two more unanswered: no streak reaches three
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await ctx.submitter.submit('recovering-activity', createMockCompletedCheckpoint());
  }

  expect(ctx.onFlushStalled).not.toHaveBeenCalled();

  await ctx.submitter.submit('recovering-activity', createMockCompletedCheckpoint());

  expect(ctx.onFlushStalled).toHaveBeenCalledOnce();
});

test('it sends a fresh traceparent with each flush and reports its trace id on rejection', async () => {
  const ctx = setupTest();
  const traceparents: Array<null | string> = [];
  let attempt = 0;

  // the recording handler returns nothing, falling through to the mock service handler after it
  server.use(
    http.post(`${resolveServiceURL('activity')}/rpc/*`, (info) => {
      traceparents.push(info.request.headers.get('traceparent'));
    }),
    mockActivityService.trackActivityProgress.handler((opts) => {
      attempt += 1;

      if (attempt === 1) {
        throw new Error('backend unreachable');
      }

      throw opts.errors.CHECKPOINT_INVALID({ data: { reason: 'broken-chain-link' } });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'traced-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('traced-activity', createMockCompletedCheckpoint());
  await ctx.submitter.submit('traced-activity', createMockCompletedCheckpoint());

  expect(traceparents).toHaveLength(2);
  expect(traceparents).toSatisfyAll((header) => /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/.test(header));
  expect(traceparents[1]).not.toBe(traceparents[0]);

  const traceID = traceparents[1]?.split('-')[1];

  expect(ctx.onInvalid).toHaveBeenCalledExactlyOnceWith(
    'traced-activity',
    'broken-chain-link',
    traceID,
  );
});

test('it sends no trace header for a call made without per-call context', async () => {
  const ctx = setupTest();
  const traceparents: Array<null | string> = [];

  // the recording handler returns nothing, falling through to the mock service handler after it
  server.use(
    http.post(`${resolveServiceURL('activity')}/rpc/*`, (info) => {
      traceparents.push(info.request.headers.get('traceparent'));
    }),
    mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 1 })),
  );

  await ctx.client.trackActivityProgress({
    activityID: 'context-free-activity',
    checkpoints: [createMockCheckpointBatchEntry({ version: 1 })],
    expectedHead: 0,
  });

  expect(traceparents).toStrictEqual([null]);
});
