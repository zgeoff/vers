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
  const activity = createMockActivityInput({ failureAction: ActivityFailureAction.Retry });

  context.setActivity(createMockActivityData());
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
    const activity = createMockActivityInput({ enemies: [createMockEnemyData()], failureAction });

    context.setActivity(createMockActivityData());
    simulation.startActivity(avatar, activity);

    const startingActivity = simulation.activity;

    simulation.addEventListener('started', startedSpy);

    await runSimulationSteps(context, simulation, 100, 700);

    expect(startedSpy).toHaveBeenCalled();
    expect(simulation.activity).not.toBe(startingActivity);
    expect(context.getActivity()).toStrictEqual(continuedActivity);
  },
);

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
