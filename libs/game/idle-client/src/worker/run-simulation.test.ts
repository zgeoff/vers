import { expect, mock, test } from 'bun:test';
import type { SimulationListener } from '@vers/idle-core';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import {
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core/test-utils';
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

test('it restarts the activity if it fails and the failure action is retry', async () => {
  const context = createMockWorkerContext();
  const simulation = createSimulation();
  const restartedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Retry });

  simulation.startActivity(avatar, activity);
  simulation.addEventListener('restarted', restartedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(restartedSpy).toHaveBeenCalled();
  expect(simulation.activity).not.toBeNull();
});

test('it does not restart the activity if it fails and the failure action is abort', async () => {
  const context = createMockWorkerContext();
  const simulation = createSimulation();
  const restartedSpy = mock<SimulationListener>();
  const stoppedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Abort });

  simulation.startActivity(avatar, activity);
  simulation.addEventListener('restarted', restartedSpy);
  simulation.addEventListener('stopped', stoppedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(restartedSpy).not.toHaveBeenCalled();
  expect(stoppedSpy).toHaveBeenCalled();
  expect(simulation.activity).toBeNull();
});

test.each([[ActivityFailureAction.Abort], [ActivityFailureAction.Retry]])(
  'it restarts the activity if it completes, regardless of the failure action (%s)',
  async (failureAction) => {
    const context = createMockWorkerContext();
    const simulation = createSimulation();
    const restartedSpy = mock<SimulationListener>();
    const avatar = createMockAvatarData();
    const activity = createMockActivityInput({ enemies: [createMockEnemyData()], failureAction });

    simulation.startActivity(avatar, activity);

    const startingActivity = simulation.activity;

    simulation.addEventListener('restarted', restartedSpy);

    await runSimulationSteps(context, simulation, 100, 700);

    expect(restartedSpy).toHaveBeenCalled();
    expect(simulation.activity).not.toBe(startingActivity);
  },
);

test('it halts at the boundary instead of restarting once the offline budget is spent', async () => {
  const channel = new MessageChannel();

  const received: Array<unknown> = [];

  channel.port2.addEventListener('message', (event) => {
    received.push(event.data);
  });

  channel.port2.start();

  const context = createMockWorkerContext({ connections: [channel.port1], remainingBudgetMs: 0 });
  const simulation = createSimulation();
  const restartedSpy = mock<SimulationListener>();
  const stoppedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Retry });

  simulation.startActivity(avatar, activity);
  simulation.addEventListener('restarted', restartedSpy);
  simulation.addEventListener('stopped', stoppedSpy);

  await runSimulationSteps(context, simulation, 100, 50);

  expect(restartedSpy).not.toHaveBeenCalled();
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

test('it broadcasts a reward-slot ledger message for each submitted checkpoint that earns slots', async () => {
  const channel = new MessageChannel();

  const received: Array<unknown> = [];

  channel.port2.addEventListener('message', (event) => {
    received.push(event.data);
  });

  channel.port2.start();

  let nextVersion = 1;

  const submitter: CheckpointSubmitter = {
    registerActivity: () => Promise.resolve(),
    submit: () => {
      const version = nextVersion;

      nextVersion += 1;

      return Promise.resolve(version);
    },
  };

  const context = createMockWorkerContext({ connections: [channel.port1], submitter });
  const simulation = createSimulation();
  const avatar = createMockAvatarData();
  const activity = createMockActivityInput({ enemies: [createMockEnemyData()] });

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
  const context = createMockWorkerContext({ connections: [channel.port1] });
  const simulation = createSimulation();
  const avatar = createMockAvatarData();
  const activity = createMockActivityInput({ enemies: [createMockEnemyData()] });

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
