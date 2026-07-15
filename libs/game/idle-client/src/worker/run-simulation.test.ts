import { expect, mock, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import type { SimulationListener } from '@vers/idle-core';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import {
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { createMockWorkerContext } from '../test-utils/factories/create-mock-worker-context';
import { runSimulation } from './run-simulation';
import type { WorkerContext } from './types';

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
  const continuedActivity = createMockActivityData();

  server.use(mockActivityService.startActivity.handler(() => continuedActivity));

  const context = createMockWorkerContext();
  const simulation = createSimulation();
  const startedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const sourceRow = createMockActivityData();

  const activity = createMockActivityInput({
    failureAction: ActivityFailureAction.Retry,
    id: sourceRow.id,
  });

  context.setActivity(sourceRow);
  context.setSimulation(simulation);
  simulation.startActivity(avatar, activity);
  simulation.addEventListener('started', startedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(startedSpy).toHaveBeenCalled();
  expect(simulation.activity).not.toBeNull();
  expect(context.getActivity()).toStrictEqual(continuedActivity);
});

test('it does not continue if it fails and the failure action is abort', async () => {
  const context = createMockWorkerContext();
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
    const continuedActivity = createMockActivityData();

    server.use(mockActivityService.startActivity.handler(() => continuedActivity));

    const context = createMockWorkerContext();
    const simulation = createSimulation();
    const startedSpy = mock<SimulationListener>();
    const avatar = createMockAvatarData();
    const sourceRow = createMockActivityData();

    const activity = createMockActivityInput({
      enemies: [createMockEnemyData()],
      failureAction,
      id: sourceRow.id,
    });

    context.setActivity(sourceRow);
    context.setSimulation(simulation);
    simulation.startActivity(avatar, activity);

    const startingActivity = simulation.activity;

    simulation.addEventListener('started', startedSpy);

    await runSimulationSteps(context, simulation, 100, 700);

    expect(startedSpy).toHaveBeenCalled();
    expect(simulation.activity).not.toBe(startingActivity);
    expect(context.getActivity()).toStrictEqual(continuedActivity);
  },
);

test('it adopts a conflict row with no confirmed checkpoints as the continuation', async () => {
  const conflictRow = createMockActivityData({ appendedHead: 0 });

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.CONFLICT({ data: { activity: conflictRow } });
    }),
  );

  const context = createMockWorkerContext();
  const simulation = createSimulation();
  const startedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const sourceRow = createMockActivityData();

  const activity = createMockActivityInput({
    failureAction: ActivityFailureAction.Retry,
    id: sourceRow.id,
  });

  context.setActivity(sourceRow);
  context.setSimulation(simulation);
  simulation.startActivity(avatar, activity);
  simulation.addEventListener('started', startedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(startedSpy).toHaveBeenCalled();
  expect(simulation.activity?.id).toBe(conflictRow.id);
  expect(context.getActivity()).toStrictEqual(conflictRow);
});

test('it rebuilds through a resync when the conflict row already has confirmed checkpoints', async () => {
  const conflictRow = createMockActivityData({
    appendedAt: new Date(Date.now() - 2000),
    appendedHead: 1,
  });

  const registerActivity = mock<CheckpointSubmitter['registerActivity']>(() => Promise.resolve());

  const submitter: CheckpointSubmitter = {
    flushHeld: () => Promise.resolve(),
    registerActivity,
    submit: () => Promise.resolve(),
  };

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.CONFLICT({ data: { activity: conflictRow } });
    }),
    mockActivityService.getLatestActivityProgress.handler(() => ({
      activity: conflictRow,
      anchor: null,
      appendedHead: 1,
      serverTime: new Date(),
      verifiedHead: 0,
    })),
  );

  const context = createMockWorkerContext({ submitter });
  const simulation = createSimulation();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const sourceRow = createMockActivityData();

  const activity = createMockActivityInput({
    failureAction: ActivityFailureAction.Retry,
    id: sourceRow.id,
  });

  context.setActivity(sourceRow);
  context.setSimulation(simulation);
  simulation.startActivity(avatar, activity);

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
  const startActivity = mock<() => void>();

  server.use(
    mockActivityService.startActivity.handler(() => {
      startActivity();

      return createMockActivityData();
    }),
  );

  const context = createMockWorkerContext();
  const simulation = createSimulation();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Retry });

  // a different row is tracked than the one the simulation runs — the fresher-owner signal
  context.setActivity(createMockActivityData());
  context.setSimulation(simulation);
  simulation.startActivity(avatar, activity);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(startActivity).not.toHaveBeenCalled();
});

test('it halts at the boundary instead of continuing once the offline budget is spent', async () => {
  const channel = new MessageChannel();

  const received: Array<unknown> = [];

  channel.port2.addEventListener('message', (event) => {
    received.push(event.data);
  });

  channel.port2.start();

  const context = createMockWorkerContext({ connections: [channel.port1], remainingBudgetMs: 0 });
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

  // MessagePort delivery is a queued task; yield once so the broadcast lands
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  expect(received).toPartiallyContain({
    halted: true,
    remainingMs: 0,
    type: 'offline_cap_status',
  });
});

test('it stops an aborted failure even when the budget is spent', async () => {
  const context = createMockWorkerContext({ remainingBudgetMs: 0 });
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
