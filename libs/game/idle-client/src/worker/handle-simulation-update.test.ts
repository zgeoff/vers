import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { handleSimulationUpdate } from './handle-simulation-update';

test('it sends simulation update messages to all connections', async () => {
  const simulation = createSimulation();

  const channel = new MessageChannel();

  const context = createStubWorkerContext({ connections: [channel.port2] });

  context.setSimulation(simulation);
  channel.port1.start();

  const received = new Promise<MessageEvent>((resolve) => {
    channel.port1.addEventListener('message', resolve, { once: true });
  });

  handleSimulationUpdate(context);

  const event = await received;

  expect(event.data).toStrictEqual({
    state: simulation.getSnapshot(),
    type: WorkerMessageType.SimulationUpdate,
  });
});
