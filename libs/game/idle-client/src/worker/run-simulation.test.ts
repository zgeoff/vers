import { expect, mock, test } from 'bun:test';
import {
  createMockActivityData,
  createMockContentDocument,
} from '@vers/contract-activity/test-utils';
import type { ActivityCheckpoint, SimulationListener } from '@vers/idle-core';
import {
  ActivityCheckpointType,
  ActivityFailureAction,
  buildLevelFromXP,
  createSimulation,
} from '@vers/idle-core';
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
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
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

test('it records the started checkpoint and a zero running xp on the first tick', async () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();
  const activity = createMockActivityInput();

  const installed = createMockActivityData({
    buildSnapshot: { level: buildLevelFromXP(300), xp: 300 },
    id: activity.id,
  });

  context.setActivity(installed);
  simulation.startActivity(createMockAvatarData(), activity);

  await runSimulation(context, simulation, 100);

  expect(context.getLatestRun()).toMatchObject({
    activityID: activity.id,
    avatarID: installed.avatarID,
    baselineXP: 300,
    deltaXP: 0,
    tail: { type: ActivityCheckpointType.Started },
  });
});

test('it leaves the recorded run untouched when the ticking simulation is not the installed activity', async () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();
  const activity = createMockActivityInput();

  // a stale simulation keeps ticking for a row a later flow already replaced
  context.setActivity(createMockActivityData({ id: 'act_installed_elsewhere' }));
  simulation.startActivity(createMockAvatarData(), activity);

  await runSimulation(context, simulation, 100);

  expect(context.getLatestRun()).toBeNull();
});

test('it keeps the failed terminal checkpoint on record after the run stops', async () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Abort });

  context.setActivity(createMockActivityData({ id: activity.id }));
  simulation.startActivity(avatar, activity);

  await runSimulationSteps(context, simulation, 100, 50);

  // the stop cleared the live activity, but the next mint still needs the run's total
  expect(simulation.activity).toBeNull();

  expect(context.getLatestRun()).toMatchObject({
    activityID: activity.id,
    tail: { type: ActivityCheckpointType.Failed },
  });
});

test("it mints the successor's build snapshot from the cleared run's terminal total when every checkpoint was confirmed", async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const sourceRow = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(500), xp: 500 },
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

  // a submit that queues nothing models the online case: every checkpoint confirmed and removed
  // from the outbox before the terminal's continuation mints
  const submit = mock<CheckpointSubmitter['submit']>(() => Promise.resolve(undefined));
  const submitter = { ...createStubSubmitter(), submit };

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_1',
    client: ctx.client,
    submitter,
  });

  const simulation = createSimulation();

  const activity = createMockActivityInput({
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 6 }, () => createMockEnemyData()),
        Array.from({ length: 3 }, () => createMockEnemyData()),
        Array.from({ length: 4 }, () => createMockEnemyData()),
      ],
    },
    failureAction: ActivityFailureAction.Abort,
    id: sourceRow.id,
  });

  context.setActivity(sourceRow);
  context.setSimulation(simulation);
  simulation.startActivity(createMockAvatarData(), activity);

  await runSimulationSteps(context, simulation, 100, 700);

  const submitted = submit.mock.calls.map(([, checkpoint]) => checkpoint);

  const completed = submitted.find(
    (checkpoint: ActivityCheckpoint) => checkpoint.type === ActivityCheckpointType.Completed,
  );

  invariant(completed !== undefined, 'the run cleared and submitted its completed checkpoint');

  const minted = context.getActivity();

  invariant(minted !== null, 'the continuation installed a fresh row');

  expect(minted.predecessorActivityID).toBe(sourceRow.id);

  // the start snapshot the cleared run was admitted at, plus the total its terminal checkpoint
  // names — the server folds the same two numbers from its own rows
  const expectedXP = 500 + completed.rewards.xp;

  expect(minted.buildSnapshot).toStrictEqual({
    level: buildLevelFromXP(expectedXP),
    xp: expectedXP,
  });
});
