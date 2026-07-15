import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData } from '@vers/contract-activity';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { SIMULATION_TIMESTEP_MS, buildSimulationInput, runAttempt } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import { createMockWorkerContext } from '../test-utils/factories/create-mock-worker-context';
import type { RequestResyncMessage, WorkerMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { handleRequestResyncMessage } from './handle-request-resync-message';

function setupTest() {
  const channel = new MessageChannel();

  const received: Array<WorkerMessage> = [];

  channel.port2.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    received.push(event.data);
  });

  channel.port2.start();

  const context = createMockWorkerContext({ connections: [channel.port1] });

  const message: RequestResyncMessage = {
    avatarID: 'avatar_1',
    type: ClientMessageType.RequestResync,
  };

  return { context, message, received };
}

async function waitForMessageCount(received: ReadonlyArray<unknown>, count: number) {
  for (let attempt = 0; attempt < 200 && received.length < count; attempt += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1);
    });
  }
}

test('it resolves to done with zero tallies for an avatar with no activity history', async () => {
  server.use(
    mockActivityService.getLatestActivityProgress.handler((opts) => {
      throw opts.errors.NOT_FOUND({ data: {} });
    }),
  );

  const ctx = setupTest();

  await handleRequestResyncMessage(ctx.context, ctx.message);
  await waitForMessageCount(ctx.received, 2);

  expect(ctx.received).toStrictEqual([
    { status: { kind: 'checking' }, type: WorkerMessageType.ResyncStatus },
    { status: { attempts: 0, kind: 'done', levelUps: 0 }, type: WorkerMessageType.ResyncStatus },
  ]);

  expect(ctx.context.getSimulation()).toBeNull();
});

test('it broadcasts capped and installs no simulation for a capped activity', async () => {
  const activity = createMockActivityData({ appendedHead: 5, status: 'capped' });

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead: 5,
      serverTime: new Date(),
      verifiedHead: 3,
    })),
  );

  const ctx = setupTest();

  await handleRequestResyncMessage(ctx.context, ctx.message);
  await waitForMessageCount(ctx.received, 2);

  expect(ctx.received).toStrictEqual([
    { status: { kind: 'checking' }, type: WorkerMessageType.ResyncStatus },
    { status: { kind: 'capped' }, type: WorkerMessageType.ResyncStatus },
  ]);

  expect(ctx.context.getSimulation()).toBeNull();
});

test('it reconstructs and installs a live simulation mid-stream, registering from the recovered cursor', async () => {
  const activity = createMockActivityData({ startedAt: new Date(Date.now() - 2000) });
  const input = buildSimulationInput(activity);

  const attempt = await runAttempt(input.activity, input.avatar, { maxDurationMs: 120_000 });

  expect(attempt.checkpoints.length).toBeGreaterThan(1);

  const appendedHead = attempt.checkpoints.length - 1;
  const lastConfirmed = attempt.checkpoints[appendedHead - 1];

  if (lastConfirmed === undefined) {
    throw new Error('expected a confirmed checkpoint short of the full stream');
  }

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead,
      serverTime: new Date(),
      verifiedHead: 0,
    })),
    mockActivityService.trackActivityProgress.handler((opts) => {
      const [first] = opts.input.checkpoints;

      expect(first?.payload.seed).toBe(lastConfirmed.nextSeed);

      return { appendedHead: opts.input.expectedHead + opts.input.checkpoints.length };
    }),
  );

  const ctx = setupTest();

  await handleRequestResyncMessage(ctx.context, ctx.message);
  await waitForMessageCount(ctx.received, 2);

  expect(ctx.received).toStrictEqual([
    { status: { kind: 'checking' }, type: WorkerMessageType.ResyncStatus },
    { status: { attempts: 0, kind: 'done', levelUps: 0 }, type: WorkerMessageType.ResyncStatus },
  ]);

  const simulation = ctx.context.getSimulation();

  expect(simulation?.activity?.id).toBe(activity.id);

  // submitting the reconstructed sim's next checkpoint proves the registered cursor chains onto
  // the recovered previousNextSeed, not the activity's own start seed
  const checkpoint = await simulation?.run(500);

  if (checkpoint) {
    await ctx.context.getSubmitter().submit(activity.id, checkpoint);
  }
});

test('it reports a divergence via the checkpoint-stream-error channel and skips registration', async () => {
  const activity = createMockActivityData({ startedAt: new Date(Date.now() - 2000) });
  const input = buildSimulationInput(activity);

  const attempt = await runAttempt(input.activity, input.avatar, { maxDurationMs: 120_000 });

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead: attempt.checkpoints.length + 5,
      serverTime: new Date(),
      verifiedHead: 0,
    })),
  );

  const ctx = setupTest();

  await handleRequestResyncMessage(ctx.context, ctx.message);
  await waitForMessageCount(ctx.received, 3);

  expect(ctx.received).toStrictEqual([
    { status: { kind: 'checking' }, type: WorkerMessageType.ResyncStatus },
    {
      activityID: activity.id,
      reason: 'reconstruction-divergence',
      type: WorkerMessageType.CheckpointStreamInvalid,
    },
    { status: { attempts: 0, kind: 'done', levelUps: 0 }, type: WorkerMessageType.ResyncStatus },
  ]);

  expect(ctx.context.getSimulation()).toBeNull();
});

test('it fast-forwards a short gap, broadcasts progress and final tallies, and installs a registered live sim on the final active row', async () => {
  const client: ActivityServiceClient = createORPCClient(
    new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` }),
  );

  // this seed's placeholder encounter completes in exactly 45s of simulated time; a 50s gap
  // leaves just under 5s of budget for the next continuation, too little for any encounter to
  // reach a terminal checkpoint, so that continuation is guaranteed to be the fast-forward's
  // unregistered final row regardless of its own random seed
  const activity = createMockActivityData({
    appendedHead: 0,
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(Date.now() - 50_000),
  });

  const startedActivities: Array<ActivityData> = [];
  const batches: Array<{ readonly activityID: string }> = [];

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead: 0,
      serverTime: new Date(),
      verifiedHead: 0,
    })),
    mockActivityService.trackActivityProgress.handler((opts) => {
      batches.push({ activityID: opts.input.activityID });

      const last = opts.input.checkpoints.at(-1);

      return { appendedHead: last?.version ?? opts.input.expectedHead };
    }),
    mockActivityService.startActivity.handler((opts) => {
      const started = createMockActivityData({ avatarID: opts.input.avatarID });

      startedActivities.push(started);

      return started;
    }),
  );

  let capturedFlush: (() => Promise<void>) | undefined;
  const onInvalid = mock<(activityID: string, reason: string) => void>();

  const submitter = createCheckpointSubmitter({
    client,
    onInvalid,
    scheduleFlush: (flush) => {
      capturedFlush = flush;
    },
  });

  const channel = new MessageChannel();

  const received: Array<WorkerMessage> = [];

  channel.port2.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    received.push(event.data);
  });

  channel.port2.start();

  const context = createMockWorkerContext({ client, connections: [channel.port1], submitter });

  const message: RequestResyncMessage = {
    avatarID: activity.avatarID,
    type: ClientMessageType.RequestResync,
  };

  await handleRequestResyncMessage(context, message);
  await waitForMessageCount(received, 3);

  expect(received).toStrictEqual([
    { status: { kind: 'checking' }, type: WorkerMessageType.ResyncStatus },
    {
      status: { attempts: 1, kind: 'fast-forwarding', levelUps: 1 },
      type: WorkerMessageType.ResyncStatus,
    },
    { status: { attempts: 1, kind: 'done', levelUps: 1 }, type: WorkerMessageType.ResyncStatus },
  ]);

  expect(startedActivities).toHaveLength(1);

  const simulation = context.getSimulation();

  invariant(simulation !== null, 'expected the fast-forward to install a live simulation');

  const liveActivityID = simulation.activity?.id;

  // the live sim attaches to the fast-forward's final, never-attempted continuation — not the
  // first activity its one completed attempt already registered
  expect(liveActivityID).toBe(startedActivities[0]?.id);
  expect(liveActivityID).not.toBe(activity.id);
  invariant(liveActivityID !== undefined, 'expected the live simulation to carry its activity id');

  let checkpoint: ActivityCheckpoint | null = null;

  while (checkpoint === null) {
    checkpoint = await simulation.run(SIMULATION_TIMESTEP_MS);
  }

  // proves the fresh continuation's registration actually happened: an unregistered activity's
  // checkpoint is silently dropped by the submitter rather than reaching the server
  await context.getSubmitter().submit(liveActivityID, checkpoint);

  await capturedFlush?.();

  expect(batches).toContainEqual({ activityID: liveActivityID });
});

test('it reconstructs a fast-forward report left mid-stream and registers from its recovered cursor', async () => {
  // this seed's placeholder encounter completes in exactly 45s of simulated time with one
  // confirmed ("started") checkpoint at its head; a 20s gap is enough to pick the fast-forward
  // plan but far short of the 45s tail, so the budget check bails before any continuation is
  // attempted, reporting back the very row the resync started from
  const activity = createMockActivityData({
    appendedHead: 1,
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(Date.now() - 20_000),
  });

  server.use(
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity,
      anchor: null,
      appendedHead: 1,
      serverTime: new Date(),
      verifiedHead: 0,
    })),
    mockActivityService.trackActivityProgress.handler((opts) => {
      const [first] = opts.input.checkpoints;

      // the started checkpoint's own nextSeed, not the activity row's start seed — proves the
      // registered cursor chains onto the reconstruction, not a fresh checkpoint-0 sim
      expect(first?.payload.seed).toBe('525ac5e6a97591b0a1877a6606b22d9c');

      return { appendedHead: opts.input.expectedHead + opts.input.checkpoints.length };
    }),
  );

  const ctx = setupTest();

  await handleRequestResyncMessage(ctx.context, ctx.message);
  await waitForMessageCount(ctx.received, 2);

  expect(ctx.received).toStrictEqual([
    { status: { kind: 'checking' }, type: WorkerMessageType.ResyncStatus },
    { status: { attempts: 0, kind: 'done', levelUps: 0 }, type: WorkerMessageType.ResyncStatus },
  ]);

  const simulation = ctx.context.getSimulation();

  // the live sim attaches to the fast-forward's own head row — no continuation was ever started
  expect(simulation?.activity?.id).toBe(activity.id);

  const checkpoint = await simulation?.run(500);

  if (checkpoint) {
    await ctx.context.getSubmitter().submit(activity.id, checkpoint);
  }
});
