import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { buildSimulationInput, runAttempt } from '@vers/idle-core';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
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
