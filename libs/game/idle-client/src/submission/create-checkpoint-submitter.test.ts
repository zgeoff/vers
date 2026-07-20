import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import { waitFor } from '@vers/test-utils';
import { HttpResponse, http } from 'msw';
import invariant from 'tiny-invariant';
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
  config: Readonly<{
    scheduleFlush?: (flush: () => Promise<void>) => void;
    scheduleRetry?: (delayMs: number, retry: () => Promise<void>) => void;
  }> = {},
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
  const onEvicted = mock<(activityID: string) => void>();
  const onFlushStalled = mock<(activityID: string, reason: string, traceID: string) => void>();
  const onInvalid = mock<(activityID: string, reason: string, traceID?: string) => void>();
  const onHeld = mock<(activityID: string) => void>();

  const submitter = createCheckpointSubmitter({
    client,
    onAcked,
    onCapped,
    onEvicted,
    onFlushStalled,
    onHeld,
    onInvalid,
    ...config,
  });

  return { client, onAcked, onCapped, onEvicted, onFlushStalled, onHeld, onInvalid, submitter };
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

test('it reports the eviction and marks the activity evicted until a registration supersedes it', async () => {
  const ctx = setupTest();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      throw opts.errors.SESSION_EVICTED({ data: {} });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'displaced-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  expect(ctx.submitter.isEvicted('displaced-activity')).toBeFalse();

  await ctx.submitter.submit('displaced-activity', createMockCompletedCheckpoint());

  expect(ctx.onEvicted).toHaveBeenCalledExactlyOnceWith('displaced-activity');
  expect(ctx.submitter.isEvicted('displaced-activity')).toBeTrue();

  // taking the writer back re-attaches through a fresh registration, which clears the marker
  await ctx.submitter.registerActivity({
    activityID: 'displaced-activity',
    appendedHead: 3,
    lastHash: 'claimed_hash',
    startChainIndex: 0,
  });

  expect(ctx.submitter.isEvicted('displaced-activity')).toBeFalse();
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

test('it holds the queue and schedules a retry at the base delay on a transport failure', async () => {
  const retries: Array<{ delayMs: number; retry: () => Promise<void> }> = [];

  const ctx = setupTest({
    scheduleRetry: (delayMs, retry) => {
      retries.push({ delayMs, retry });
    },
  });

  server.use(mockActivityService.trackActivityProgress.handler(() => HttpResponse.error()));

  await ctx.submitter.registerActivity({
    activityID: 'transport-failure-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('transport-failure-activity', createMockCompletedCheckpoint());

  expect(ctx.onHeld).toHaveBeenCalledExactlyOnceWith('transport-failure-activity');
  expect(retries).toHaveLength(1);
  expect(retries[0]?.delayMs).toBe(10_000);

  const stillQueued = await readQueuedCheckpoints('transport-failure-activity');

  expect(stillQueued).toHaveLength(1);
});

test('it doubles the retry delay on each consecutive failure up to the cap', async () => {
  const retries: Array<{ delayMs: number; retry: () => Promise<void> }> = [];

  const ctx = setupTest({
    scheduleRetry: (delayMs, retry) => {
      retries.push({ delayMs, retry });
    },
  });

  server.use(mockActivityService.trackActivityProgress.handler(() => HttpResponse.error()));

  await ctx.submitter.registerActivity({
    activityID: 'backoff-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('backoff-activity', createMockCompletedCheckpoint());

  // fire the scheduled retry directly rather than a fresh submit, so each attempt resends the
  // same held batch instead of queuing a new one
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scheduled = retries.at(-1);

    expect(scheduled).toBeDefined();

    await scheduled?.retry();
  }

  expect(retries.map((entry) => entry.delayMs)).toStrictEqual([
    10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000,
  ]);
});

test('it resets the backoff exponent on a successful flush', async () => {
  const retries: Array<{ delayMs: number; retry: () => Promise<void> }> = [];
  let capturedFlush: (() => Promise<void>) | undefined;
  let shouldFail = true;

  const ctx = setupTest({
    scheduleFlush: (flush) => {
      capturedFlush = flush;
    },
    scheduleRetry: (delayMs, retry) => {
      retries.push({ delayMs, retry });
    },
  });

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      if (shouldFail) {
        return HttpResponse.error();
      }

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'reset-backoff-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  // a non-terminal checkpoint keeps the activity's state alive across the successful flush, so
  // the second failure backs off on the same state the first failure escalated
  await ctx.submitter.submit('reset-backoff-activity', createMockProgressCheckpoint());

  await capturedFlush?.();

  expect(retries).toHaveLength(1);
  expect(retries[0]?.delayMs).toBe(10_000);

  shouldFail = false;

  await retries[0]?.retry();

  const remaining = await readQueuedCheckpoints('reset-backoff-activity');

  expect(remaining).toStrictEqual([]);

  shouldFail = true;

  await ctx.submitter.submit('reset-backoff-activity', createMockProgressCheckpoint());

  await capturedFlush?.();

  expect(retries).toHaveLength(2);
  expect(retries[1]?.delayMs).toBe(10_000);
});

test('it holds the queue and schedules a retry identically on UNAUTHORIZED', async () => {
  const retries: Array<{ delayMs: number; retry: () => Promise<void> }> = [];

  const ctx = setupTest({
    scheduleRetry: (delayMs, retry) => {
      retries.push({ delayMs, retry });
    },
  });

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'unauthorized-backoff-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('unauthorized-backoff-activity', createMockCompletedCheckpoint());

  expect(ctx.onHeld).toHaveBeenCalledExactlyOnceWith('unauthorized-backoff-activity');
  expect(retries).toHaveLength(1);
  expect(retries[0]?.delayMs).toBe(10_000);
});

test('it keeps a single pending retry per activity across repeated failures', async () => {
  const retries: Array<{ delayMs: number; retry: () => Promise<void> }> = [];

  const ctx = setupTest({
    scheduleRetry: (delayMs, retry) => {
      retries.push({ delayMs, retry });
    },
  });

  server.use(mockActivityService.trackActivityProgress.handler(() => HttpResponse.error()));

  await ctx.submitter.registerActivity({
    activityID: 'single-retry-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  // each terminal submission flushes and fails immediately, but only the first failure may
  // schedule a retry — the second folds into the pending one instead of starting a second chain
  await ctx.submitter.submit('single-retry-activity', createMockCompletedCheckpoint());
  await ctx.submitter.submit('single-retry-activity', createMockCompletedCheckpoint());

  expect(ctx.onHeld).toHaveBeenCalledTimes(2);
  expect(retries).toHaveLength(1);
});

test('it ignores a stale retry callback superseded by a reconnect flush', async () => {
  const retries: Array<{ delayMs: number; retry: () => Promise<void> }> = [];
  const track = mock<() => void>();
  let shouldFail = true;

  const ctx = setupTest({
    scheduleRetry: (delayMs, retry) => {
      retries.push({ delayMs, retry });
    },
  });

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      track();

      if (shouldFail) {
        return HttpResponse.error();
      }

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'stale-retry-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('stale-retry-activity', createMockCompletedCheckpoint());

  expect(retries).toHaveLength(1);

  shouldFail = false;

  await ctx.submitter.flushHeld();

  expect(track).toHaveBeenCalledTimes(2);

  // the reconnect flush superseded the earlier retry: firing it neither resends nor reschedules
  await retries[0]?.retry();

  expect(track).toHaveBeenCalledTimes(2);
  expect(retries).toHaveLength(1);
});

test('it folds a retry firing while a flush is already in flight into the pending flush', async () => {
  const retries: Array<{ delayMs: number; retry: () => Promise<void> }> = [];
  const track = mock<(input: unknown) => void>();
  let releaseFirstCall: (() => void) | undefined;

  const ctx = setupTest({
    scheduleRetry: (delayMs, retry) => {
      retries.push({ delayMs, retry });
    },
  });

  server.use(
    mockActivityService.trackActivityProgress.handler(async (opts) => {
      track(opts.input);

      if (track.mock.calls.length === 1) {
        return HttpResponse.error();
      }

      await new Promise<void>((resolve) => {
        releaseFirstCall = resolve;
      });

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'in-flight-retry-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('in-flight-retry-activity', createMockCompletedCheckpoint());

  expect(retries).toHaveLength(1);

  const retryCall = retries[0]?.retry();

  await waitFor(() => {
    expect(track.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  const secondRetry = retries[0]?.retry();

  releaseFirstCall?.();

  await retryCall;
  await secondRetry;

  expect(track).toHaveBeenCalledTimes(2);

  const remaining = await readQueuedCheckpoints('in-flight-retry-activity');

  expect(remaining).toStrictEqual([]);
});

test('it flushes every held activity immediately and resets their backoff', async () => {
  const retries: Array<{ delayMs: number; retry: () => Promise<void> }> = [];
  let capturedFlush: (() => Promise<void>) | undefined;
  let shouldFail = true;

  const ctx = setupTest({
    scheduleFlush: (flush) => {
      capturedFlush = flush;
    },
    scheduleRetry: (delayMs, retry) => {
      retries.push({ delayMs, retry });
    },
  });

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      if (shouldFail) {
        return HttpResponse.error();
      }

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'flush-held-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  // a non-terminal checkpoint keeps the activity's state alive across the reconnect flush, so
  // the next failure backs off on the same state the first failure escalated
  await ctx.submitter.submit('flush-held-activity', createMockProgressCheckpoint());

  await capturedFlush?.();

  expect(retries).toHaveLength(1);

  shouldFail = false;

  await ctx.submitter.flushHeld();

  const remaining = await readQueuedCheckpoints('flush-held-activity');

  expect(remaining).toStrictEqual([]);

  shouldFail = true;

  await ctx.submitter.submit('flush-held-activity', createMockProgressCheckpoint());

  await capturedFlush?.();

  expect(retries).toHaveLength(2);
  expect(retries[1]?.delayMs).toBe(10_000);
});

test('it resends a held terminal checkpoint via the captured retry and empties the queue', async () => {
  const retries: Array<{ delayMs: number; retry: () => Promise<void> }> = [];
  let shouldFail = true;

  const ctx = setupTest({
    scheduleRetry: (delayMs, retry) => {
      retries.push({ delayMs, retry });
    },
  });

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      if (shouldFail) {
        return HttpResponse.error();
      }

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'held-terminal-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('held-terminal-activity', createMockCompletedCheckpoint());

  const heldRows = await readQueuedCheckpoints('held-terminal-activity');

  expect(heldRows).toHaveLength(1);

  shouldFail = false;

  await retries[0]?.retry();

  const remaining = await readQueuedCheckpoints('held-terminal-activity');

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
  const ctx = setupTest({ scheduleRetry: () => {} });

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
  const ctx = setupTest({ scheduleRetry: () => {} });
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
  const ctx = setupTest({ scheduleRetry: () => {} });
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

  expect(traceparents).toSatisfyAll(
    (header: null | string) => header !== null && /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/.test(header),
  );

  expect(traceparents[1]).not.toBe(traceparents[0]);

  const traceID = traceparents[1]?.split('-')[1];

  expect(ctx.onInvalid).toHaveBeenCalledExactlyOnceWith(
    'traced-activity',
    'broken-chain-link',
    traceID,
  );
});

test('it delivers queued non-terminal checkpoints when flushNow is called', async () => {
  let capturedFlush: (() => Promise<void>) | undefined;

  const ctx = setupTest({
    scheduleFlush: (flush) => {
      capturedFlush = flush;
    },
  });

  const track = mock<(input: unknown) => void>();

  // the partial ack leaves the second checkpoint queued, so a progress-window callback that
  // still believed itself scheduled would re-send it — the no-op assertion below depends on it
  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'flush-now-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('flush-now-activity', createMockProgressCheckpoint());
  await ctx.submitter.submit('flush-now-activity', createMockProgressCheckpoint());

  expect(track).not.toHaveBeenCalled();

  await ctx.submitter.flushNow('flush-now-activity');

  expect(track).toHaveBeenCalledExactlyOnceWith({
    activityID: 'flush-now-activity',
    checkpoints: expect.toBeArrayOfSize(2),
    expectedHead: 0,
  });

  // the superseded progress-window callback is a no-op: firing it re-sends nothing even though
  // the queue still holds the unconfirmed checkpoint
  invariant(capturedFlush !== undefined, 'expected the progress window to have been scheduled');

  await capturedFlush();

  expect(track).toHaveBeenCalledOnce();
});

test('it resolves flushNow for an unknown activity without a request', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.flushNow('never-registered');

  expect(track).not.toHaveBeenCalled();
});

test('it sends no trace header for a call made without per-call context', async () => {
  const ctx = setupTest({ scheduleRetry: () => {} });
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

test('it evicts the activity after ACTIVITY_CAPPED so a later registration re-seeds an empty queue', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);
      throw opts.errors.ACTIVITY_CAPPED({ data: { appendedHead: 0 } });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'capped-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('capped-evict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 1 };
    }),
  );

  // a re-registration after eviction runs its own seed read and flush rather than resolving the
  // capped registration, proving the tombstoned state is gone
  await ctx.submitter.registerActivity({
    activityID: 'capped-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('capped-evict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledTimes(2);

  expect(track).toHaveBeenLastCalledWith({
    activityID: 'capped-evict-activity',
    checkpoints: expect.toBeArrayOfSize(1),
    expectedHead: 0,
  });
});

test('it evicts the activity after ACTIVITY_TERMINAL so a later registration re-seeds an empty queue', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);
      throw opts.errors.ACTIVITY_TERMINAL({ data: { appendedHead: 0, status: 'stopped' } });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'terminal-status-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('terminal-status-evict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'terminal-status-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('terminal-status-evict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledTimes(2);
});

test('it evicts the activity after SESSION_EVICTED so a later registration re-seeds an empty queue', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);
      throw opts.errors.SESSION_EVICTED({ data: {} });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'session-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('session-evict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'session-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('session-evict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledTimes(2);
});

test('it evicts the activity after NOT_FOUND so a later registration re-seeds an empty queue', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);
      throw opts.errors.NOT_FOUND({ data: {} });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'not-found-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('not-found-evict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'not-found-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('not-found-evict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledTimes(2);
});

test('it keeps the tombstoned registration on CHECKPOINT_INVALID so a later registration attempt does not reseed', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);
      throw opts.errors.CHECKPOINT_INVALID({ data: { reason: 'broken-chain-link' } });
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'invalid-tombstone-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('invalid-tombstone-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  // a later registration attempt resolves the original tombstoned registration instead of
  // re-seeding, so no second seed read or flush ever reaches the server
  await ctx.submitter.registerActivity({
    activityID: 'invalid-tombstone-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  expect(track).toHaveBeenCalledOnce();

  const version = await ctx.submitter.submit(
    'invalid-tombstone-activity',
    createMockProgressCheckpoint(),
  );

  expect(version).toBeUndefined();
  expect(track).toHaveBeenCalledOnce();
});

test('it evicts the activity once a terminal checkpoint drains fully confirmed', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 2 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'terminal-drain-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  await ctx.submitter.submit('terminal-drain-evict-activity', createMockStartedCheckpoint());
  await ctx.submitter.submit('terminal-drain-evict-activity', createMockCompletedCheckpoint());

  expect(track).toHaveBeenCalledOnce();

  // a later registration seeded from a deliberately different head re-seeds and re-flushes
  // rather than resolving a stale registration, proving the fully confirmed terminal drain
  // evicted it — retained state would keep the old cursor and submit version 3 at expectedHead 2
  await ctx.submitter.registerActivity({
    activityID: 'terminal-drain-evict-activity',
    appendedHead: 7,
    lastHash: 'fresh_hash',
    startChainIndex: 0,
  });

  const version = await ctx.submitter.submit(
    'terminal-drain-evict-activity',
    createMockCompletedCheckpoint(),
  );

  expect(version).toBe(8);
  expect(track).toHaveBeenCalledTimes(2);

  expect(track).toHaveBeenLastCalledWith({
    activityID: 'terminal-drain-evict-activity',
    checkpoints: [expect.objectContaining({ prevHash: 'fresh_hash', version: 8 })],
    expectedHead: 7,
  });
});

test('it evicts a hydrated terminal row once its resend drains fully confirmed', async () => {
  await writeQueuedCheckpoint(
    'hydrated-terminal-activity',
    createMockCheckpointBatchEntry({ payload: { type: 'completed' }, version: 1 }),
  );

  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      return { appendedHead: 1 };
    }),
  );

  // the registration's own flush resends the queued terminal row and fully confirms it
  await ctx.submitter.registerActivity({
    activityID: 'hydrated-terminal-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  expect(track).toHaveBeenCalledOnce();

  const drained = await readQueuedCheckpoints('hydrated-terminal-activity');

  expect(drained).toStrictEqual([]);

  // a later registration seeded from a deliberately different head re-seeds and re-flushes
  // rather than resolving a stale registration, proving the confirmed hydrated terminal row
  // evicted the activity even though no live submission ever queued it
  await ctx.submitter.registerActivity({
    activityID: 'hydrated-terminal-activity',
    appendedHead: 5,
    lastHash: 'fresh_hash',
    startChainIndex: 0,
  });

  const version = await ctx.submitter.submit(
    'hydrated-terminal-activity',
    createMockCompletedCheckpoint(),
  );

  expect(version).toBe(6);
  expect(track).toHaveBeenCalledTimes(2);

  expect(track).toHaveBeenLastCalledWith({
    activityID: 'hydrated-terminal-activity',
    checkpoints: [expect.objectContaining({ prevHash: 'fresh_hash', version: 6 })],
    expectedHead: 5,
  });
});

test('it evicts safely when a concurrent flush call sets flushPending during a terminal drain', async () => {
  const ctx = setupTest();
  const track = mock<(input: unknown) => void>();
  let releaseFirstCall: (() => void) | undefined;

  server.use(
    mockActivityService.trackActivityProgress.handler(async (opts) => {
      track(opts.input);

      if (track.mock.calls.length === 1) {
        await new Promise<void>((resolve) => {
          releaseFirstCall = resolve;
        });
      }

      return { appendedHead: 1 };
    }),
  );

  await ctx.submitter.registerActivity({
    activityID: 'concurrent-evict-activity',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });

  const terminalSubmit = ctx.submitter.submit(
    'concurrent-evict-activity',
    createMockCompletedCheckpoint(),
  );

  await waitFor(() => {
    expect(track).toHaveBeenCalledOnce();
  });

  // a flush call landing while the terminal drain is in flight marks flushPending, so the finally
  // block's re-flush after eviction must find the state gone and return without throwing
  const heldFlush = ctx.submitter.flushHeld();

  releaseFirstCall?.();

  await expect(terminalSubmit).toResolve();
  await expect(heldFlush).toResolve();

  expect(track).toHaveBeenCalledOnce();
});
