import { expect, mock, onTestFinished, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ErrorEvent } from '@sentry/browser';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import type { ActivityCheckpoint } from '@vers/idle-core';
import {
  ActivityFailureAction,
  SIMULATION_TIMESTEP_MS,
  buildSimulationInput,
  createSimulation,
  runAttempt,
} from '@vers/idle-core';
import { createTestAccessToken, resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { waitFor } from '@vers/test-utils';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readFailureActionCache } from '../submission/read-failure-action-cache';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import type { ActivityServiceClient } from '../submission/types';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { createMockStartedCheckpoint } from '../test-utils/factories/create-mock-started-checkpoint';
import type { RequestResyncMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { handleRequestResyncMessage } from './handle-request-resync-message';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

interface SetupTestConfig {
  readonly failureAction?: ActivityFailureAction;
  readonly userID: string;
}

/**
 * Builds an authed client acting as the given user and a
 * worker context wearing that client — so a resync's fetch, append, and start calls hit the same
 * state transitions the real service applies to the rows the test seeds in the mock db. The
 * returned flush delivers whatever the submitter has scheduled since the last call.
 */
async function setupTest(config: Readonly<SetupTestConfig>) {
  const token = await createTestAccessToken(config.userID);

  const client: ActivityServiceClient = createORPCClient(
    new RPCLink({
      headers: { authorization: `Bearer ${token}` },
      url: `${resolveServiceURL('activity')}/rpc`,
    }),
  );

  let capturedFlush: (() => Promise<void>) | undefined;

  const submitter = createCheckpointSubmitter({
    client,
    onInvalid: mock<(activityID: string, reason: string) => void>(),
    scheduleFlush: (flush) => {
      capturedFlush = flush;
    },
  });

  const connection = createTestConnection();

  const context = createStubWorkerContext({
    client,
    connections: [connection.port],
    submitter,
    ...(config.failureAction === undefined ? {} : { failureAction: config.failureAction }),
  });

  return { client, connection, context, flush: () => capturedFlush?.() ?? Promise.resolve() };
}

test('it broadcasts nothing for an avatar with no activity history', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  // posted on the worker's own port after the handler settles, this arrives after anything the
  // handler broadcast on the same channel — an empty prefix proves the resync stayed silent
  ctx.connection.port.postMessage({ online: true, type: WorkerMessageType.ConnectionStatus });

  await ctx.connection.waitForMessages(1);

  expect(ctx.connection.received).toStrictEqual([
    { online: true, type: WorkerMessageType.ConnectionStatus },
  ]);

  expect(ctx.context.getSimulation()).toBeNull();
});

test('it broadcasts capped and installs no simulation for a capped activity', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  await db.activityCollection.create({
    appendedHead: 5,
    avatarID: avatar.id,
    status: 'capped',
    verifiedHead: 3,
  });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  await ctx.connection.waitForMessages(1);

  expect(ctx.connection.received).toStrictEqual([
    { status: { kind: 'capped' }, type: WorkerMessageType.ResyncStatus },
  ]);

  expect(ctx.context.getSimulation()).toBeNull();
});

test('it delivers a queued row for the resync-determined latest activity rather than sweeping it, while sweeping every other activity', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const activity = await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    startedAt: new Date(),
  });

  await writeQueuedCheckpoint(activity.id, createMockCheckpointBatchEntry({ version: 1 }));

  await writeQueuedCheckpoint(
    'stray-unrelated-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  // the resync's own drain delivered the determined latest activity's queued row over the
  // network rather than the sweep silently discarding it
  const landed = db.checkpointCollection.findMany((q) => q.where({ activityID: activity.id }));

  expect(landed).toHaveLength(1);

  const remainingQueue = await readQueuedCheckpoints(activity.id);
  const sweptQueue = await readQueuedCheckpoints('stray-unrelated-activity');

  expect(remainingQueue).toStrictEqual([]);
  expect(sweptQueue).toStrictEqual([]);
});

test('it sweeps every queued checkpoint when the avatar has no activity history', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  await writeQueuedCheckpoint(
    'stray-no-activity-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  const swept = await readQueuedCheckpoints('stray-no-activity-activity');

  expect(swept).toStrictEqual([]);
});

test('it keeps the queued rows of an activity that went live while the resync was running', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    startedAt: new Date(),
  });

  const token = await createTestAccessToken(user.id);

  const client: ActivityServiceClient = createORPCClient(
    new RPCLink({
      headers: { authorization: `Bearer ${token}` },
      url: `${resolveServiceURL('activity')}/rpc`,
    }),
  );

  let releaseHeldFlush: (() => void) | undefined;

  const heldFlush = new Promise<void>((resolve) => {
    releaseHeldFlush = resolve;
  });

  const context = createStubWorkerContext({
    client,
    submitter: {
      flushHeld: () => heldFlush,
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
    },
  });

  const freshActivity = createMockActivityData({ id: 'fresh-live-activity' });

  await writeQueuedCheckpoint(freshActivity.id, createMockCheckpointBatchEntry({ version: 1 }));

  await writeQueuedCheckpoint(
    'stray-mid-resync-activity',
    createMockCheckpointBatchEntry({ version: 1 }),
  );

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  const handled = handleRequestResyncMessage(context, message);

  // a fresher activity goes live while the resync is parked on its held-batch flush, exactly as
  // a set-activity request landing mid-resync would install it
  const input = buildSimulationInput(freshActivity);
  const simulation = createSimulation();

  simulation.startActivity(input.avatar, input.activity);
  context.setSimulation(simulation);
  releaseHeldFlush?.();

  await handled;

  // the sweep kept the live activity's queued row — its running writer's own pipeline — while
  // still removing the genuinely stranded activity's row
  const kept = await readQueuedCheckpoints(freshActivity.id);
  const swept = await readQueuedCheckpoints('stray-mid-resync-activity');

  expect(kept).toHaveLength(1);
  expect(swept).toStrictEqual([]);
});

test('it flushes a held checkpoint for a previously tracked, no-longer-latest activity before sweeping it', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const staleActivity = await db.activityCollection.create({
    avatarID: avatar.id,
    startedAt: new Date(Date.now() - 60_000),
  });

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    startedAt: new Date(),
  });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.trackActivityProgress.handler((opts) => {
      track(opts.input);

      if (track.mock.calls.length === 1) {
        return HttpResponse.error();
      }

      return { appendedHead: 1 };
    }),
  );

  await ctx.context.getSubmitter().registerActivity({
    activityID: staleActivity.id,
    appendedHead: 0,
    lastHash: staleActivity.lastHash,
    startChainIndex: staleActivity.startChainIndex,
  });

  await ctx.context.getSubmitter().submit(staleActivity.id, createMockStartedCheckpoint());
  await ctx.flush();

  // the flush attempt failed and held the row for retry
  const heldRows = await readQueuedCheckpoints(staleActivity.id);

  expect(heldRows).toHaveLength(1);
  expect(track).toHaveBeenCalledOnce();

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  // flushHeld ran before the sweep determined a fresher activity is latest, delivering the held
  // row over the network rather than letting the sweep silently discard it
  expect(track).toHaveBeenCalledTimes(2);

  const remaining = await readQueuedCheckpoints(staleActivity.id);

  expect(remaining).toStrictEqual([]);
});

test('it reconstructs and installs a live simulation mid-stream, registering from the recovered cursor', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const activity = await db.activityCollection.create({
    avatarID: avatar.id,
    startedAt: new Date(Date.now() - 2000),
  });

  const input = buildSimulationInput(activity);

  const attempt = await runAttempt(input.activity, input.avatar, { maxDurationMs: 120_000 });

  expect(attempt.checkpoints.length).toBeGreaterThan(1);

  const appendedHead = attempt.checkpoints.length - 1;
  const lastConfirmed = attempt.checkpoints[appendedHead - 1];

  invariant(
    lastConfirmed !== undefined,
    'expected a confirmed checkpoint short of the full stream',
  );

  await db.activityCollection.update(activity, {
    data(record) {
      record.appendedHead = appendedHead;
    },
    strict: true,
  });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  // posted on the worker's own port after the handler settles, this arrives after anything the
  // handler broadcast on the same channel — an empty prefix proves the resync stayed silent
  ctx.connection.port.postMessage({ online: true, type: WorkerMessageType.ConnectionStatus });

  await ctx.connection.waitForMessages(1);

  expect(ctx.connection.received).toStrictEqual([
    { online: true, type: WorkerMessageType.ConnectionStatus },
  ]);

  const simulation = ctx.context.getSimulation();

  invariant(simulation !== null, 'expected the resync to install a live simulation');
  expect(simulation.activity?.id).toBe(activity.id);

  // submitting the reconstructed sim's next checkpoint proves the registered cursor chains onto
  // the recovered previousNextSeed, not the activity's own start seed
  let checkpoint: ActivityCheckpoint | null = null;

  while (checkpoint === null) {
    checkpoint = await simulation.run(SIMULATION_TIMESTEP_MS);
  }

  await ctx.context.getSubmitter().submit(activity.id, checkpoint);
  await ctx.flush();

  const landed = db.checkpointCollection.findMany((q) => q.where({ activityID: activity.id }));

  expect(landed.map((row) => row.payload.seed)).toStrictEqual([lastConfirmed.nextSeed]);
});

test('it reports a divergence via the checkpoint-stream-error channel and skips registration', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const activity = await db.activityCollection.create({
    avatarID: avatar.id,
    startedAt: new Date(Date.now() - 2000),
  });

  const input = buildSimulationInput(activity);

  const attempt = await runAttempt(input.activity, input.avatar, { maxDurationMs: 120_000 });

  // a confirmed head beyond anything the activity's own stream produced is unreachable by
  // reconstruction, forcing the divergence path
  await db.activityCollection.update(activity, {
    data(record) {
      record.appendedHead = attempt.checkpoints.length + 5;
    },
    strict: true,
  });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  await ctx.connection.waitForMessages(1);

  expect(ctx.connection.received).toStrictEqual([
    {
      activityID: activity.id,
      reason: 'reconstruction-divergence',
      type: WorkerMessageType.CheckpointStreamInvalid,
    },
  ]);

  expect(ctx.context.getSimulation()).toBeNull();
});

test('it fast-forwards a short gap, broadcasts progress and final tallies, and installs a registered live sim on the final active row', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  // this seed's placeholder encounter completes in exactly 60s of simulated time; a 63s gap
  // leaves just under 3s of budget for the next continuation, too little for any encounter to
  // reach a terminal checkpoint, so that continuation is guaranteed to be the fast-forward's
  // unregistered final row regardless of its own random seed
  const activity = await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(Date.now() - 63_000),
  });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  await ctx.connection.waitForMessages(3);

  expect(ctx.connection.received).toStrictEqual([
    {
      status: { attempts: 0, kind: 'fast-forwarding', levelUps: 0 },
      type: WorkerMessageType.ResyncStatus,
    },
    {
      status: { attempts: 1, kind: 'fast-forwarding', levelUps: 1 },
      type: WorkerMessageType.ResyncStatus,
    },
    { status: { attempts: 1, kind: 'done', levelUps: 1 }, type: WorkerMessageType.ResyncStatus },
  ]);

  // the completed attempt's terminal batch closed the seeded row, so the backend holds exactly
  // one fresh active continuation for the avatar
  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the fast-forward to mint an active continuation');
  expect(minted.id).not.toBe(activity.id);

  const simulation = ctx.context.getSimulation();

  invariant(simulation !== null, 'expected the fast-forward to install a live simulation');

  // the live sim attaches to the fast-forward's final, never-attempted continuation — not the
  // first activity its one completed attempt already registered
  expect(simulation.activity?.id).toBe(minted.id);

  let checkpoint: ActivityCheckpoint | null = null;

  while (checkpoint === null) {
    checkpoint = await simulation.run(SIMULATION_TIMESTEP_MS);
  }

  // proves the fresh continuation's registration actually happened: an unregistered activity's
  // checkpoint is silently dropped by the submitter rather than reaching the server
  await ctx.context.getSubmitter().submit(minted.id, checkpoint);
  await ctx.flush();

  const landed = db.checkpointCollection.findMany((q) => q.where({ activityID: minted.id }));

  expect(landed).toHaveLength(1);
});

test('it reconstructs a fast-forward report left mid-stream and registers from its recovered cursor', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  // this seed's placeholder encounter completes in exactly 60s of simulated time with one
  // confirmed ("started") checkpoint at its head; a 20s gap is enough to pick the fast-forward
  // plan but far short of the 60s tail, so the budget check bails before any continuation is
  // attempted, reporting back the very row the resync started from
  const activity = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: avatar.id,
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(Date.now() - 20_000),
  });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  await ctx.connection.waitForMessages(2);

  expect(ctx.connection.received).toStrictEqual([
    {
      status: { attempts: 0, kind: 'fast-forwarding', levelUps: 0 },
      type: WorkerMessageType.ResyncStatus,
    },
    { status: { attempts: 0, kind: 'done', levelUps: 0 }, type: WorkerMessageType.ResyncStatus },
  ]);

  const simulation = ctx.context.getSimulation();

  invariant(simulation !== null, 'expected the fast-forward to install a live simulation');

  // the live sim attaches to the fast-forward's own head row — no continuation was ever started
  expect(simulation.activity?.id).toBe(activity.id);

  let checkpoint: ActivityCheckpoint | null = null;

  while (checkpoint === null) {
    checkpoint = await simulation.run(SIMULATION_TIMESTEP_MS);
  }

  await ctx.context.getSubmitter().submit(activity.id, checkpoint);
  await ctx.flush();

  // the running seed the reconstructed cursor carries forward from the confirmed started
  // checkpoint — proves the registered cursor chains onto the reconstruction, not a fresh
  // checkpoint-0 sim
  const landed = db.checkpointCollection.findMany((q) => q.where({ activityID: activity.id }));

  expect(landed.map((row) => row.payload.seed)).toMatchInlineSnapshot(`
    [
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072",
    ]
  `);
});

test('it attaches a fresh login live without broadcasting any catch-up status', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const activity = await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    startedAt: new Date(),
  });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  // posted on the worker's own port after the handler settles, this arrives after anything the
  // handler broadcast on the same channel — an empty prefix proves the resync stayed silent
  ctx.connection.port.postMessage({ online: true, type: WorkerMessageType.ConnectionStatus });

  await ctx.connection.waitForMessages(1);

  expect(ctx.connection.received).toStrictEqual([
    { online: true, type: WorkerMessageType.ConnectionStatus },
  ]);

  const simulation = ctx.context.getSimulation();

  invariant(simulation !== null, 'expected the resync to install a live simulation');
  expect(simulation.activity?.id).toBe(activity.id);
});

test('it adopts a server-persisted retry preference during resync, caching and broadcasting the change', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ failureAction: 'retry', userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    startedAt: new Date(),
  });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  await ctx.connection.waitForMessages(1);

  expect(ctx.connection.received).toStrictEqual([
    { failureAction: ActivityFailureAction.Retry, type: WorkerMessageType.FailureActionStatus },
  ]);

  expect(ctx.context.getFailureAction()).toBe(ActivityFailureAction.Retry);

  const cached = await readFailureActionCache();

  expect(cached).toStrictEqual({
    avatarID: avatar.id,
    dirty: false,
    failureAction: ActivityFailureAction.Retry,
  });
});

test('it flushes a dirty local failure action to the server during resync, clearing dirty on success', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ failureAction: ActivityFailureAction.Retry, userID: user.id });

  ctx.context.setFailureActionDirty(true);

  // the dirty value lives in the persisted outbox, scoped to this avatar — the record's avatar is
  // what lets the resync flush it rather than adopt the server's
  await writeFailureActionCache({
    avatarID: avatar.id,
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    startedAt: new Date(),
  });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  expect(ctx.context.isFailureActionDirty()).toBeFalse();

  const cached = await readFailureActionCache();

  expect(cached).toStrictEqual({
    avatarID: avatar.id,
    dirty: false,
    failureAction: ActivityFailureAction.Retry,
  });

  const updatedAvatar = db.avatarCollection.findFirst((q) => q.where({ id: avatar.id }));

  invariant(updatedAvatar !== undefined, 'expected the seeded avatar to still exist');
  expect(updatedAvatar.failureAction).toBe('retry');
});

test('it keeps the dirty flag when the resync push to the server fails', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ failureAction: ActivityFailureAction.Retry, userID: user.id });

  ctx.context.setFailureActionDirty(true);

  // the dirty value lives in the persisted outbox, scoped to this avatar — a failed push must leave
  // that record intact for the next resync to retry
  await writeFailureActionCache({
    avatarID: avatar.id,
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });

  server.use(
    mockActivityService.updateFailureAction.handler(() => {
      throw new Error('unreachable service');
    }),
  );

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    startedAt: new Date(),
  });

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(ctx.context, message);

  expect(ctx.context.isFailureActionDirty()).toBeTrue();
  expect(ctx.context.getFailureAction()).toBe(ActivityFailureAction.Retry);

  const cached = await readFailureActionCache();

  expect(cached).toStrictEqual({
    avatarID: avatar.id,
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });
});

test('it reports a fault to the error backend and broadcasts a failed status when the resync fails outright', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const connection = createTestConnection();

  const context = createStubWorkerContext({
    connections: [connection.port],
    submitter: {
      flushHeld: () => Promise.reject(new Error('held flush exploded')),
      flushNow: () => Promise.resolve(),
      registerActivity: () => Promise.resolve(),
      submit: () => Promise.resolve(undefined),
    },
  });

  const message: RequestResyncMessage = {
    avatarID: 'avatar-with-held-tail',
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(context, message);

  // posted on the worker's own port after the handler settles, this arrives after anything the
  // handler broadcast on the same channel — a single failed status proves no connection-status
  // change rode along with it
  connection.port.postMessage({ online: true, type: WorkerMessageType.ConnectionStatus });

  await connection.waitForMessages(2);

  expect(connection.received).toStrictEqual([
    {
      status: { avatarID: 'avatar-with-held-tail', kind: 'failed' },
      type: WorkerMessageType.ResyncStatus,
    },
    { online: true, type: WorkerMessageType.ConnectionStatus },
  ]);

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ site: 'resync' });
  expect(context.isResyncInFlight()).toBe(false);
});
