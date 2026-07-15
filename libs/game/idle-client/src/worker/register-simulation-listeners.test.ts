import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { waitFor } from '@vers/test-utils';
import { createMockWorkerContext } from '../test-utils/factories/create-mock-worker-context';
import type { WorkerMessage } from '../types';
import { registerSimulationListeners } from './register-simulation-listeners';

test('it broadcasts a simulation update once the installed simulation reports one', async () => {
  const channel = new MessageChannel();

  const received: Array<WorkerMessage> = [];

  channel.port2.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    received.push(event.data);
  });

  channel.port2.start();

  const context = createMockWorkerContext({ connections: [channel.port1] });
  const simulation = createSimulation();

  context.setSimulation(simulation);

  registerSimulationListeners(context, simulation);

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  for (let tick = 0; tick < 20; tick += 1) {
    await simulation.run(500);
  }

  await waitFor(() => {
    expect(received).toPartiallyContain({ type: 'simulation_update' });
  });
});
