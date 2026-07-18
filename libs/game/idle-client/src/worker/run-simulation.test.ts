import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { SimulationListener } from '@vers/idle-core';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import {
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core/test-utils';
import { createTestAccessToken, resolveServiceURL } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import invariant from 'tiny-invariant';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import { WorkerMessageType } from '../types';
import { runSimulation } from './run-simulation';
import type { WorkerContext } from './types';

interface SetupTestConfig {
  readonly userID: string;
}

/**
 * Builds an authed client acting as the given user, so
 * continuation starts hit the same conflict/mint logic the real service applies to the rows the
 * test seeds in the mock db.
 */
async function setupTest(config: Readonly<SetupTestConfig>) {
  const token = await createTestAccessToken(config.userID);

  const client: ActivityServiceClient = createORPCClient(
    new RPCLink({
      headers: { authorization: `Bearer ${token}` },
      url: `${resolveServiceURL('activity')}/rpc`,
    }),
  );

  return { client };
}

async function runSimulationSteps(
  context: WorkerContext,
  simulation: ReturnType<typeof createSimulation>,
  timestep: number,
  steps: number,
) {
  for (let step = 0; step < steps; step += 1) {
    await runSimulation(context, simulation, timestep);
  }
}

test('it continues into a fresh server-started row if it fails and the failure action is retry', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  // the running row's terminal already landed server-side, so no active row blocks the start
  const sourceRow = await db.activityCollection.create({
    avatarID: avatar.id,
    status: 'stopped',
  });

  const context = createStubWorkerContext({ client: ctx.client });
  const simulation = createSimulation();
  const startedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatarData = createMockAvatarData({ life: 1 });

  const activity = createMockActivityInput({
    failureAction: ActivityFailureAction.Retry,
    id: sourceRow.id,
  });

  context.setActivity(sourceRow);
  context.setSimulation(simulation);
  simulation.startActivity(avatarData, activity);
  simulation.addEventListener('started', startedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'the continuation minted an active row');
  expect(startedSpy).toHaveBeenCalled();
  expect(simulation.activity).not.toBeNull();
  expect(minted.scopeID).toBe(sourceRow.scopeID);
  expect(context.getActivity()).toStrictEqual(minted);
});

test('it does not continue if it fails and the failure action is abort', async () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();
  const startedSpy = mock<SimulationListener>();
  const stoppedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Abort });

  simulation.startActivity(avatar, activity);
  simulation.addEventListener('started', startedSpy);
  simulation.addEventListener('stopped', stoppedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(startedSpy).not.toHaveBeenCalled();
  expect(stoppedSpy).toHaveBeenCalled();
  expect(simulation.activity).toBeNull();
});

test.each([[ActivityFailureAction.Abort], [ActivityFailureAction.Retry]])(
  'it continues into a fresh server-started row if it completes, regardless of the failure action (%s)',
  async (failureAction) => {
    const user = await db.userCollection.create({});
    const avatar = await db.avatarCollection.create({ userID: user.id });
    const ctx = await setupTest({ userID: user.id });

    const sourceRow = await db.activityCollection.create({
      avatarID: avatar.id,
      status: 'stopped',
    });

    const context = createStubWorkerContext({ client: ctx.client });
    const simulation = createSimulation();
    const startedSpy = mock<SimulationListener>();
    const avatarData = createMockAvatarData();

    const activity = createMockActivityInput({
      encounter: {
        waves: [
          Array.from({ length: 6 }, () => createMockEnemyData()),
          Array.from({ length: 6 }, () => createMockEnemyData()),
          Array.from({ length: 3 }, () => createMockEnemyData()),
          Array.from({ length: 4 }, () => createMockEnemyData()),
        ],
      },
      failureAction,
      id: sourceRow.id,
    });

    context.setActivity(sourceRow);
    context.setSimulation(simulation);
    simulation.startActivity(avatarData, activity);

    const startingActivity = simulation.activity;

    simulation.addEventListener('started', startedSpy);

    await runSimulationSteps(context, simulation, 100, 700);

    const minted = db.activityCollection.findFirst((q) =>
      q.where({ avatarID: avatar.id, status: 'active' }),
    );

    invariant(minted !== undefined, 'the continuation minted an active row');
    expect(startedSpy).toHaveBeenCalled();
    expect(simulation.activity).not.toBe(startingActivity);
    expect(context.getActivity()).toStrictEqual(minted);
  },
);

test('it adopts a conflict row with no confirmed checkpoints as the continuation', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const sourceRow = await db.activityCollection.create({
    avatarID: avatar.id,
    startedAt: new Date(Date.now() - 60_000),
    status: 'stopped',
  });

  // a live never-appended row already owns the avatar, so the start conflicts with it
  const conflictRow = await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    status: 'active',
  });

  const context = createStubWorkerContext({ client: ctx.client });
  const simulation = createSimulation();
  const startedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatarData = createMockAvatarData({ life: 1 });

  const activity = createMockActivityInput({
    failureAction: ActivityFailureAction.Retry,
    id: sourceRow.id,
  });

  context.setActivity(sourceRow);
  context.setSimulation(simulation);
  simulation.startActivity(avatarData, activity);
  simulation.addEventListener('started', startedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(startedSpy).toHaveBeenCalled();
  expect(simulation.activity?.id).toBe(conflictRow.id);
  expect(context.getActivity()).toStrictEqual(conflictRow);
});

test('it rebuilds through a resync when the conflict row already has confirmed checkpoints', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const sourceRow = await db.activityCollection.create({
    avatarID: avatar.id,
    startedAt: new Date(Date.now() - 60_000),
    status: 'stopped',
  });

  // a live progressed row owns the avatar: the conflict must rebuild, never adopt a zero cursor
  const conflictRow = await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 1,
    avatarID: avatar.id,
    status: 'active',
  });

  const registerActivity = mock<CheckpointSubmitter['registerActivity']>(() => Promise.resolve());

  const submitter: CheckpointSubmitter = {
    flushHeld: () => Promise.resolve(),
    flushNow: () => Promise.resolve(),
    registerActivity,
    submit: () => Promise.resolve<number | undefined>(undefined),
  };

  const context = createStubWorkerContext({ client: ctx.client, submitter });
  const simulation = createSimulation();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatarData = createMockAvatarData({ life: 1 });

  const activity = createMockActivityInput({
    failureAction: ActivityFailureAction.Retry,
    id: sourceRow.id,
  });

  context.setActivity(sourceRow);
  context.setSimulation(simulation);
  simulation.startActivity(avatarData, activity);

  await runSimulationSteps(context, simulation, 100, 50);

  // the resync reconstructed the row's confirmed checkpoint and registered its real cursor —
  // never a zero cursor onto a progressed stream
  expect(registerActivity).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ activityID: conflictRow.id, appendedHead: 1 }),
  );

  expect(context.getSimulation()).not.toBe(simulation);
  expect(context.getSimulation()?.activity?.id).toBe(conflictRow.id);
});

test('it skips the continuation when a fresher activity replaced this row mid-submission', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ctx = await setupTest({ userID: user.id });

  const context = createStubWorkerContext({ client: ctx.client });
  const simulation = createSimulation();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatarData = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Retry });

  // a different row is tracked than the one the simulation runs — the fresher-owner signal
  const trackedRow = await db.activityCollection.create({ avatarID: avatar.id, status: 'stopped' });

  context.setActivity(trackedRow);
  context.setSimulation(simulation);
  simulation.startActivity(avatarData, activity);

  await runSimulationSteps(context, simulation, 100, 50);

  // no continuation start reached the service: nothing was minted for the avatar
  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, status: 'active' }),
  );

  expect(minted).toBeUndefined();
});

test('it halts at the boundary instead of continuing once the offline budget is spent', async () => {
  const connection = createTestConnection();

  const context = createStubWorkerContext({
    connections: [connection.port],
    remainingBudgetMs: 0,
  });

  const simulation = createSimulation();
  const startedSpy = mock<SimulationListener>();
  const stoppedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Retry });

  simulation.startActivity(avatar, activity);
  simulation.addEventListener('started', startedSpy);
  simulation.addEventListener('stopped', stoppedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(startedSpy).not.toHaveBeenCalled();
  expect(stoppedSpy).not.toHaveBeenCalled();

  await connection.waitForMessages(1);

  expect(connection.received).toPartiallyContain({
    halted: true,
    remainingMs: 0,
    type: 'offline_cap_status',
  });
});

test('it stops an aborted failure even when the budget is spent', async () => {
  const context = createStubWorkerContext({ remainingBudgetMs: 0 });
  const simulation = createSimulation();
  const stoppedSpy = mock<SimulationListener>();
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Abort });

  simulation.startActivity(avatar, activity);
  simulation.addEventListener('stopped', stoppedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(stoppedSpy).toHaveBeenCalled();
  expect(simulation.activity).toBeNull();
});

test('it broadcasts a reward-slot ledger message for each submitted checkpoint that earns slots', async () => {
  const channel = new MessageChannel();

  const received: Array<unknown> = [];

  channel.port2.addEventListener('message', (event) => {
    received.push(event.data);
  });

  channel.port2.start();

  let nextVersion = 1;

  const submitter: CheckpointSubmitter = {
    flushHeld: () => Promise.resolve(),
    flushNow: () => Promise.resolve(),
    registerActivity: () => Promise.resolve(),
    submit: () => {
      const version = nextVersion;

      nextVersion += 1;

      return Promise.resolve(version);
    },
  };

  const context = createStubWorkerContext({ connections: [channel.port1], submitter });
  const simulation = createSimulation();
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 3 }, () => createMockEnemyData()),
        Array.from({ length: 4 }, () => createMockEnemyData()),
      ],
    },
  });

  simulation.startActivity(avatar, activity);

  await runSimulationSteps(context, simulation, 100, 700);

  // MessagePort delivery is a queued task; yield once so every broadcast lands
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  const rewardMessages = received.filter(
    (message): message is { rewardSlotCount: number; type: string; version: number } =>
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'reward_slots_recorded',
  );

  expect(rewardMessages.length).toBeGreaterThan(0);
  expect(rewardMessages.every((message) => message.rewardSlotCount > 0)).toBeTrue();

  // the very first submitted checkpoint is the zero-slot Started checkpoint (version 1) — it
  // never earns a broadcast of its own
  expect(rewardMessages.some((message) => message.version === 1)).toBeFalse();
});

test('it never broadcasts a ledger message for a checkpoint the submitter dropped', async () => {
  const channel = new MessageChannel();

  const received: Array<unknown> = [];

  channel.port2.addEventListener('message', (event) => {
    received.push(event.data);
  });

  channel.port2.start();

  // the default mock context's submitter always resolves `undefined`, standing in for a
  // dropped checkpoint (an unattached or already-invalid activity)
  const context = createStubWorkerContext({ connections: [channel.port1] });
  const simulation = createSimulation();
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 3 }, () => createMockEnemyData()),
        Array.from({ length: 4 }, () => createMockEnemyData()),
      ],
    },
  });

  simulation.startActivity(avatar, activity);

  await runSimulationSteps(context, simulation, 100, 700);

  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  const rewardMessages = received.filter(
    (message): message is { type: string } =>
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'reward_slots_recorded',
  );

  expect(rewardMessages).toStrictEqual([]);
});

test('it broadcasts an activity completed message when an activity completes', async () => {
  const connection = createTestConnection();

  const context = createStubWorkerContext({
    connections: [connection.port],
    remainingBudgetMs: 0,
  });

  const simulation = createSimulation();
  const avatar = createMockAvatarData();

  const activity = createMockActivityInput({
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 3 }, () => createMockEnemyData()),
        Array.from({ length: 4 }, () => createMockEnemyData()),
      ],
    },
  });

  simulation.startActivity(avatar, activity);

  await runSimulationSteps(context, simulation, 100, 700);

  await connection.waitForMessages(1);

  const completedMessages = connection.received.filter(
    (message) => message.type === WorkerMessageType.ActivityCompleted,
  );

  expect(completedMessages).toStrictEqual([
    { activityID: activity.id, type: WorkerMessageType.ActivityCompleted },
  ]);
});

test('it never broadcasts an activity completed message for a failed activity', async () => {
  const connection = createTestConnection();
  const context = createStubWorkerContext({ connections: [connection.port] });
  const simulation = createSimulation();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Abort });

  simulation.startActivity(avatar, activity);

  await runSimulationSteps(context, simulation, 100, 50);

  // MessagePort delivery is a queued task; yield once so every broadcast lands
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  const completedMessages = connection.received.filter(
    (message) => message.type === WorkerMessageType.ActivityCompleted,
  );

  expect(completedMessages).toStrictEqual([]);
});
