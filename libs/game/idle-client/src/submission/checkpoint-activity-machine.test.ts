import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import { waitFor } from '@vers/test-utils';
import { HttpResponse } from 'msw';
import { SimulatedClock, createActor } from 'xstate';
import { server } from '../mocks/node';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import type { CheckpointActivityEmittedEvent } from './checkpoint-activity-machine';
import { checkpointActivityMachine } from './checkpoint-activity-machine';
import { PROGRESS_FLUSH_INTERVAL_MS, RETRY_BACKOFF_CAP_MS } from './constants';
import type { ActivityServiceClient } from './types';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

function setupTest(
  config: Readonly<{
    activityID?: string;
    latestQueuedVersion?: number;
    onAcked?: (activityID: string, appendedHead: number) => void;
    signal?: AbortSignal;
    terminalQueued?: boolean;
  }> = {},
) {
  const clock = new SimulatedClock();
  const link = new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);
  const onAcked = config.onAcked ?? mock<(activityID: string, appendedHead: number) => void>();
  const onInvalid = mock<(activityID: string, reason: string, traceID?: string) => void>();
  const scheduleProgressFlush = mock<() => void>();
  const emitted: Array<CheckpointActivityEmittedEvent> = [];

  const actor = createActor(checkpointActivityMachine, {
    clock,
    input: {
      activityID: config.activityID ?? 'activity-machine-test',
      client,
      expectedHead: 0,
      latestQueuedVersion: config.latestQueuedVersion,
      onAcked,
      onCapped: undefined,
      onEvicted: undefined,
      onInvalid,
      onServerContact: undefined,
      retryTimings: { maxTimeout: RETRY_BACKOFF_CAP_MS, minTimeout: PROGRESS_FLUSH_INTERVAL_MS },
      scheduleProgressFlush,
      signal: config.signal,
      terminalQueued: config.terminalQueued ?? false,
    },
  });

  actor.on('*', (event) => {
    emitted.push(event);
  });

  actor.start();

  return { actor, clock, emitted, onAcked, onInvalid, scheduleProgressFlush };
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

  expect(ctx.emitted).toStrictEqual([
    { activityID: 'transport-failure-machine-activity', type: 'held' },
  ]);
});

test('it retries once the backoff delay elapses, until the batch lands', async () => {
  let shouldFail = true;
  const track = mock<() => void>();
  const ctx = setupTest({ activityID: 'backoff-machine-activity' });

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

  ctx.clock.increment(RETRY_BACKOFF_CAP_MS);

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('evicted')).toBeTrue();
  });

  expect(track).toHaveBeenCalledTimes(2);
});

test('it runs an immediate attempt from retrying without advancing the backoff attempt counter', async () => {
  const track = mock<() => void>();
  const ctx = setupTest({ activityID: 'flush-now-retrying-activity' });

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
  const ctx = setupTest({ activityID: 'flush-held-retrying-activity' });

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
    expect(ctx.actor.getSnapshot().matches('retrying')).toBeTrue();
  });

  ctx.clock.increment(RETRY_BACKOFF_CAP_MS);

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('retrying')).toBeTrue();
    expect(ctx.actor.getSnapshot().context.retryAttempt).toBe(1);
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

  // an abort that failed to cancel the backoff would fire an attempt as soon as it elapses
  ctx.clock.increment(RETRY_BACKOFF_CAP_MS);

  await new Promise((resolve) => {
    setTimeout(resolve, 0);
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
    expect(ctx.emitted).toStrictEqual([
      { activityID: 'callback-failed-machine-activity', error: ackFailure, type: 'retryFailed' },
    ]);
  });

  expect(ctx.actor.getSnapshot().matches('idle')).toBeTrue();
});

test('it resets the backoff attempt counter once a retried batch lands, so a later outage starts at the base window', async () => {
  let shouldFail = true;
  const ctx = setupTest({ activityID: 'backoff-reset-machine-activity' });

  server.use(
    mockActivityService.trackActivityProgress.handler(() => {
      if (shouldFail) {
        return HttpResponse.error();
      }

      return { appendedHead: 1 };
    }),
  );

  await writeQueuedCheckpoint(
    'backoff-reset-machine-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  ctx.actor.send({ isTerminal: false, type: 'QUEUED', version: 1 });
  ctx.actor.send({ type: 'FLUSH_DUE' });

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('retrying')).toBeTrue();
  });

  ctx.clock.increment(RETRY_BACKOFF_CAP_MS);

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('retrying')).toBeTrue();
    expect(ctx.actor.getSnapshot().context.retryAttempt).toBe(1);
  });

  shouldFail = false;

  ctx.clock.increment(RETRY_BACKOFF_CAP_MS);

  await waitFor(() => {
    expect(ctx.actor.getSnapshot().matches('idle')).toBeTrue();
  });

  expect(ctx.actor.getSnapshot().context.retryAttempt).toBe(0);
});
