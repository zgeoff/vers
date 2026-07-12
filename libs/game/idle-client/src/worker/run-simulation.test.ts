import { expect, mock, test } from 'bun:test';
import type { SimulationListener } from '@vers/idle-core';
import {
  ActivityFailureAction,
  createMockActivityData,
  createMockAvatarData,
  createMockEnemyData,
  createSimulation,
} from '@vers/idle-core';
import xxhash from 'xxhash-wasm';
import { runSimulation } from './run-simulation';

const hasher = await xxhash();

async function driveSimulation(
  simulation: ReturnType<typeof createSimulation>,
  timestep: number,
  steps: number,
) {
  for (let step = 0; step < steps; step += 1) {
    await runSimulation(simulation, timestep);
  }
}

test('it restarts the activity if it fails and the failure action is retry', async () => {
  const simulation = createSimulation(hasher);
  const restartedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityData({ failureAction: ActivityFailureAction.Retry });

  simulation.startActivity(avatar, activity);
  simulation.addEventListener('restarted', restartedSpy);

  await driveSimulation(simulation, 100, 50);

  expect(restartedSpy).toHaveBeenCalled();
  expect(simulation.activity).not.toBeNull();
});

test('it does not restart the activity if it fails and the failure action is abort', async () => {
  const simulation = createSimulation(hasher);
  const restartedSpy = mock<SimulationListener>();
  const stoppedSpy = mock<SimulationListener>();

  // life of 1 dies on the very first hit taken, forcing a failed checkpoint
  const avatar = createMockAvatarData({ life: 1 });
  const activity = createMockActivityData({ failureAction: ActivityFailureAction.Abort });

  simulation.startActivity(avatar, activity);
  simulation.addEventListener('restarted', restartedSpy);
  simulation.addEventListener('stopped', stoppedSpy);

  await driveSimulation(simulation, 100, 50);

  expect(restartedSpy).not.toHaveBeenCalled();
  expect(stoppedSpy).toHaveBeenCalled();
  expect(simulation.activity).toBeNull();
});

test.each([[ActivityFailureAction.Abort], [ActivityFailureAction.Retry]])(
  'it restarts the activity if it completes, regardless of the failure action (%s)',
  async (failureAction) => {
    const simulation = createSimulation(hasher);
    const restartedSpy = mock<SimulationListener>();
    const avatar = createMockAvatarData();
    const activity = createMockActivityData({ enemies: [createMockEnemyData()], failureAction });

    simulation.startActivity(avatar, activity);

    const startingActivity = simulation.activity;

    simulation.addEventListener('restarted', restartedSpy);

    await driveSimulation(simulation, 100, 700);

    expect(restartedSpy).toHaveBeenCalled();
    expect(simulation.activity).not.toBe(startingActivity);
  },
);
