import { expect, mock, test } from 'bun:test';
import type { SimulationListener } from '@vers/idle-core';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import {
  createMockActivityInput,
  createMockAvatarData,
  createMockEnemyData,
} from '@vers/idle-core/test-utils';
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
