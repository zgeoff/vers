import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import { waitFor } from '@vers/test-utils';
import { HttpResponse } from 'msw';
import { createActor } from 'xstate';
import { server } from '../mocks/node';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { checkpointActivityMachine } from './checkpoint-activity-machine';
import type { ActivityServiceClient } from './types';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

function setupTest(
  config: Readonly<{
    activityID?: string;
    latestQueuedVersion?: number;
    onAcked?: (activityID: string, appendedHead: number) => void;
    retryTimings?: Readonly<{ maxTimeout: number; minTimeout: number }>;
    signal?: AbortSignal;
    terminalQueued?: boolean;
  }> = {},
) {
  const link = new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);
  const onAcked = config.onAcked ?? mock<(activityID: string, appendedHead: number) => void>();
  const onCapped = mock<(activityID: string, appendedHead: number) => void>();
  const onEvicted = mock<(activityID: string) => void>();
  const onFlushStalled = mock<(activityID: string, reason: string, traceID: string) => void>();
  const onHeld = mock<(activityID: string) => void>();
  const onInvalid = mock<(activityID: string, reason: string, traceID?: string) => void>();
  const onRetryFailed = mock<(activityID: string, error: unknown) => void>();
  const onServerContact = mock<() => void>();
  const scheduleProgressFlush = mock<() => void>();

  const actor = createActor(checkpointActivityMachine, {
    input: {
      activityID: config.activityID ?? 'activity-machine-test',
      client,
      expectedHead: 0,
      latestQueuedVersion: config.latestQueuedVersion,
      onAcked,
      onCapped,
      onEvicted,
      onFlushStalled,
      onHeld,
      onInvalid,
      onRetryFailed,
      onServerContact,
      retryTimings: config.retryTimings ?? { maxTimeout: 300_000, minTimeout: 10_000 },
      scheduleProgressFlush,
      signal: config.signal,
      terminalQueued: config.terminalQueued ?? false,
    },
  }).start();

  return {
    actor,
    onAcked,
    onCapped,
    onEvicted,
    onFlushStalled,
    onHeld,
    onInvalid,
    onRetryFailed,
    onServerContact,
    scheduleProgressFlush,
  };
}

test('it arms the shared progress window and waits for an explicit flush-due event, not a timer', async () => {
  const ctx = setupTest({ activityID: 'scheduled-window-activity' });

  ctx.actor.send({ isTerminal: false, type: 'QUEUED', version: 1 });

  expect(ctx.actor.getSnapshot().matches('scheduled')).toBeTrue();
  expect(ctx.scheduleProgressFlush).toHaveBeenCalledOnce();

  ctx.actor.send({ type: 'FLUSH_DUE' });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('idle')).toBeTrue();
  });
});

test('it flushes immediately on a terminal checkpoint, bypassing the progress window', async () => {
  const ctx = setupTest({ activityID: 'terminal-flush-activity' });

  server.use(mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 1 })));

  await writeQueuedCheckpoint(
    'terminal-flush-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  // a terminal checkpoint that drains fully confirmed evicts rather than resting idle — the
  // scheduling assertion below is what actually proves the progress window was bypassed
  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('evicted')).toBeTrue();
  });

  expect(ctx.scheduleProgressFlush).not.toHaveBeenCalled();
  expect(ctx.onAcked).toHaveBeenCalledExactlyOnceWith('terminal-flush-activity', 1);
});

test('it moves to retrying and reports the batch held on a transport failure', async () => {
  const ctx = setupTest({ activityID: 'transport-failure-machine-activity' });

  server.use(mockActivityService.trackActivityProgress.handler(() => HttpResponse.error()));

  await writeQueuedCheckpoint(
    'transport-failure-machine-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('retrying')).toBeTrue();
  });

  expect(ctx.onHeld).toHaveBeenCalledExactlyOnceWith('transport-failure-machine-activity');
});

test('it retries on a real backoff timer, driven by tiny retryTimings, until the batch lands', async () => {
  let shouldFail = true;
  const track = mock<() => void>();

  const ctx = setupTest({
    activityID: 'backoff-machine-activity',
    retryTimings: { maxTimeout: 20, minTimeout: 5 },
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

  await writeQueuedCheckpoint(
    'backoff-machine-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('retrying')).toBeTrue();
  });

  shouldFail = false;

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('evicted')).toBeTrue();
  });

  expect(track.mock.calls.length).toBeGreaterThan(1);
});

test('it runs an immediate attempt from retrying without advancing the backoff attempt counter', async () => {
  const track = mock<() => void>();

  const ctx = setupTest({
    activityID: 'flush-now-retrying-activity',
    retryTimings: { maxTimeout: 100_000, minTimeout: 50_000 },
  });

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      track();

      return HttpResponse.error();
    }),
  );

  await writeQueuedCheckpoint(
    'flush-now-retrying-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('retrying')).toBeTrue();
  });

  expect(ctx.actor.getSnapshot().context.retryAttempt).toBe(0);

  ctx.actor.send({ type: 'FLUSH_NOW' });

  await waitFor(() => {
    expect(track).toHaveBeenCalledTimes(2);
  });

  expect(ctx.actor.getSnapshot().matches('retrying')).toBeTrue();
  expect(ctx.actor.getSnapshot().context.retryAttempt).toBe(0);
});

test('it resets the backoff attempt counter and re-flushes when flushHeld arrives while retrying', async () => {
  let shouldFail = true;

  const ctx = setupTest({
    activityID: 'flush-held-retrying-activity',
    retryTimings: { maxTimeout: 20, minTimeout: 5 },
  });

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      if (shouldFail) {
        return HttpResponse.error();
      }

      return { appendedHead: 1 };
    }),
  );

  await writeQueuedCheckpoint(
    'flush-held-retrying-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().context.retryAttempt).toBeGreaterThan(0);
  });

  shouldFail = false;

  ctx.actor.send({ type: 'FLUSH_HELD' });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('evicted')).toBeTrue();
  });

  expect(ctx.actor.getSnapshot().context.retryAttempt).toBe(0);
});

test('it never cancels an in-flight attempt when flushHeld arrives mid-flight', async () => {
  const track = mock<() => void>();
  let release: (() => void) | undefined;
  const ctx = setupTest({ activityID: 'mid-flight-flush-held-activity' });

  server.use(
    mockActivityService.trackActivityProgress.handler(async () => {
      track();

      await new Promise<void>((resolve) => {
        release = resolve;
      });

      return { appendedHead: 1 };
    }),
  );

  await writeQueuedCheckpoint(
    'mid-flight-flush-held-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  await waitFor(() => {
    expect(track).toHaveBeenCalledOnce();
  });

  ctx.actor.send({ type: 'FLUSH_HELD' });

  expect(track).toHaveBeenCalledOnce();
  release?.();

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('evicted')).toBeTrue();
  });

  expect(track).toHaveBeenCalledOnce();
});

test('it exits retrying with no re-entry once the shutdown signal aborts', async () => {
  const shutdownController = new AbortController();

  const track = mock<() => void>();

  const ctx = setupTest({
    activityID: 'shutdown-abort-activity',
    retryTimings: { maxTimeout: 100_000, minTimeout: 50_000 },
    signal: shutdownController.signal,
  });

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      track();

      return HttpResponse.error();
    }),
  );

  await writeQueuedCheckpoint(
    'shutdown-abort-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('retrying')).toBeTrue();
  });

  shutdownController.abort();

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('idle')).toBeTrue();
  });

  const callsAtAbort = track.mock.calls.length;

  await new Promise((resolve) => {
    setTimeout(resolve, 40);
  });

  expect(track.mock.calls.length).toBe(callsAtAbort);
});

test('it reaches invalid on CHECKPOINT_INVALID and never flushes again', async () => {
  const track = mock<() => void>();
  const ctx = setupTest({ activityID: 'invalid-machine-activity' });

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track();
      throw opts.errors.CHECKPOINT_INVALID({ data: { reason: 'broken-chain-link' } });
    }),
  );

  await writeQueuedCheckpoint(
    'invalid-machine-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('invalid')).toBeTrue();
  });

  expect(track).toHaveBeenCalledOnce();

  ctx.actor.send({ type: 'FLUSH_NOW' });

  expect(ctx.actor.getSnapshot().matches('invalid')).toBeTrue();
  expect(track).toHaveBeenCalledOnce();
});

test('it reaches evicted once a terminal checkpoint fully drains', async () => {
  const ctx = setupTest({
    activityID: 'evicted-machine-activity',
    latestQueuedVersion: 1,
    terminalQueued: true,
  });

  server.use(mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 1 })));

  await writeQueuedCheckpoint(
    'evicted-machine-activity',
    createMockCheckpointBatchEntry({ payload: { type: 'completed' }, version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('evicted')).toBeTrue();
  });

  expect(ctx.actor.getSnapshot().status).toBe('done');
});

test('it reports a callback failure and holds the batch without starting a retry loop', async () => {
  const ackFailure = new Error('ack callback exploded');

  const ctx = setupTest({
    activityID: 'callback-failed-machine-activity',
    onAcked: () => {
      throw ackFailure;
    },
  });

  server.use(mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 1 })));

  await writeQueuedCheckpoint(
    'callback-failed-machine-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: true, type: 'QUEUED', version: 1 });

  await waitFor(() => {
    expect(ctx.onRetryFailed).toHaveBeenCalledExactlyOnceWith(
      'callback-failed-machine-activity',
      ackFailure,
    );
  });

  expect(ctx.actor.getSnapshot().matches('idle')).toBeTrue();
});
