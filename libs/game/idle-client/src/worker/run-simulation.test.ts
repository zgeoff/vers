import { expect, mock, test } from 'bun:test';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { SimulationListener } from '@vers/idle-core';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import {
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import invariant from 'tiny-invariant';
import { writeContentDocumentCache } from '../content/write-content-document-cache';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { WorkerMessageType } from '../types';
import { runSimulation } from './run-simulation';
import type { WorkerContext } from './types';
import type { WorkerMessage } from './worker-to-client-message-schema';

interface SetupTestConfig {
  readonly userID: string;
}

async function setupTest(config: Readonly<SetupTestConfig>) {
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', config.userID);

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

test('it continues into a fresh locally minted row if it fails and the failure action is retry', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  // the running row's terminal already landed server-side, so no active row blocks the start
  const sourceRow = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'stopped',
  });

  // the continuation mints from this device's cache, so the scope's inputs must be present
  const nodeSeed = createMockNodeSeed({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    nodeID: sourceRow.scopeID,
  });

  await writeNodeSeeds(viewer.avatar.id, [nodeSeed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: nodeSeed.contentVersion }),
  );

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_1',
    client: ctx.client,
  });

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

  const minted = context.getActivity();

  invariant(minted !== null, 'the continuation installed a fresh row');

  expect(startedSpy).toHaveBeenCalled();
  expect(simulation.activity).not.toBeNull();
  expect(minted.scopeID).toBe(sourceRow.scopeID);
  expect(minted.predecessorActivityID).toBe(sourceRow.id);
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
  'it continues into a fresh locally minted row if it completes, regardless of the failure action (%s)',
  async (failureAction) => {
    const viewer = await createViewer();
    const ctx = await setupTest({ userID: viewer.user.id });

    const sourceRow = await db.activityCollection.create({
      avatarID: viewer.avatar.id,
      status: 'stopped',
    });

    const nodeSeed = createMockNodeSeed({
      avatarID: viewer.avatar.id,
      encounterNode: { difficulty: 1 },
      nodeID: sourceRow.scopeID,
    });

    await writeNodeSeeds(viewer.avatar.id, [nodeSeed]);
    await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

    await writeContentDocumentCache(
      createMockContentDocument({ contentVersion: nodeSeed.contentVersion }),
    );

    const context = createStubWorkerContext({
      bundledEngineHash: 'engine_hash_1',
      client: ctx.client,
    });

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

    const minted = context.getActivity();

    invariant(minted !== null, 'the continuation installed a fresh row');

    expect(startedSpy).toHaveBeenCalled();
    expect(simulation.activity).not.toBe(startingActivity);
    expect(minted.predecessorActivityID).toBe(sourceRow.id);
  },
);

test('it skips the continuation when a fresher activity replaced this row mid-submission', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client });
  const simulation = createSimulation();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatarData = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Retry });

  // a different row is tracked than the one the simulation runs — the fresher-owner signal
  const trackedRow = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'stopped',
  });

  context.setActivity(trackedRow);
  context.setSimulation(simulation);
  simulation.startActivity(avatarData, activity);

  await runSimulationSteps(context, simulation, 100, 50);

  // no continuation start reached the service: nothing was minted for the avatar
  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  expect(minted).toBeUndefined();
});

test('it halts at the boundary instead of continuing once the offline budget is spent', async () => {
  const context = createStubWorkerContext({ remainingBudgetMs: 0 });
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

  expect(context.getBroadcasts()).toPartiallyContain({
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
    isEvicted: () => false,
    removeEviction: () => {},
  };

  const context = createStubWorkerContext({ submitter });
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

  const rewardMessages = context
    .getBroadcasts()
    .filter(
      (
        message,
      ): message is Extract<WorkerMessage, { type: WorkerMessageType.RewardSlotsRecorded }> =>
        message.type === WorkerMessageType.RewardSlotsRecorded,
    );

  expect(rewardMessages.length).toBeGreaterThan(0);
  expect(rewardMessages.every((message) => message.rewardSlotCount > 0)).toBeTrue();

  // the very first submitted checkpoint is the zero-slot Started checkpoint (version 1) — it
  // never earns a broadcast of its own
  expect(rewardMessages.some((message) => message.version === 1)).toBeFalse();
});

test('it never broadcasts a ledger message for a checkpoint the submitter dropped', async () => {
  // the default mock context's submitter always resolves `undefined`, standing in for a
  // dropped checkpoint (an unattached or already-invalid activity)
  const context = createStubWorkerContext();
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

  const rewardMessages = context
    .getBroadcasts()
    .filter((message) => message.type === WorkerMessageType.RewardSlotsRecorded);

  expect(rewardMessages).toStrictEqual([]);
});

test('it broadcasts an activity completed message when an activity completes', async () => {
  const context = createStubWorkerContext({ remainingBudgetMs: 0 });
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

  const completedMessages = context
    .getBroadcasts()
    .filter((message) => message.type === WorkerMessageType.ActivityCompleted);

  expect(completedMessages).toStrictEqual([
    { activityID: activity.id, type: WorkerMessageType.ActivityCompleted },
  ]);
});

test('it never broadcasts an activity completed message for a failed activity', async () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Abort });

  simulation.startActivity(avatar, activity);

  await runSimulationSteps(context, simulation, 100, 50);

  const completedMessages = context
    .getBroadcasts()
    .filter((message) => message.type === WorkerMessageType.ActivityCompleted);

  expect(completedMessages).toStrictEqual([]);
});
