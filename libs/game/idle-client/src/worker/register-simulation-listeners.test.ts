import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
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
    // oxlint-disable-next-line no-await-in-loop -- ticking one live simulation forward step by step until an update lands
    await simulation.run(500);
  }

  for (let attempt = 0; attempt < 200 && received.length === 0; attempt += 1) {
    // oxlint-disable-next-line no-await-in-loop -- polling for the queued MessagePort delivery
    await new Promise((resolve) => {
      setTimeout(resolve, 1);
    });
  }

  expect(received).toPartiallyContain({ type: 'simulation_update' });
});
