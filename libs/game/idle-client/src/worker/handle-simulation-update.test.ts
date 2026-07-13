import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import { WorkerMessageType } from '../types';
import { handleSimulationUpdate } from './handle-simulation-update';
import type { WorkerContext } from './types';

test('it sends simulation update messages to all connections', async () => {
  const simulation = createSimulation();

  const channel = new MessageChannel();

  const context: WorkerContext = {
    connections: new Set([channel.port2]),
    getSimulation: () => simulation,
    getSubmitter: () => ({
      attach: () => Promise.resolve(),
      submit: () => Promise.resolve(),
    }),
    removeConnection: () => {
      //
    },
    setSimulation: () => {
      //
    },
  };

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
