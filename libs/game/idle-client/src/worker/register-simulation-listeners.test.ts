import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { waitFor } from '@vers/test-utils';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { registerSimulationListeners } from './register-simulation-listeners';

test('it broadcasts a simulation update once the installed simulation reports one', async () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();

  context.setSimulation(simulation);

  registerSimulationListeners(context, simulation);

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  for (let tick = 0; tick < 20; tick += 1) {
    await simulation.run(500);
  }

  await waitFor(() => {
    expect(context.getBroadcasts()).toPartiallyContain({ type: 'simulation_update' });
  });
});
