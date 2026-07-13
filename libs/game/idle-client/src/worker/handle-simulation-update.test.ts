import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import xxhash from 'xxhash-wasm';
import { WorkerMessageType } from '../types';
import { handleSimulationUpdate } from './handle-simulation-update';
import type { WorkerContext } from './types';

const hasher = await xxhash();

test('it sends simulation update messages to all connections', async () => {
  const simulation = createSimulation(hasher);

  const channel = new MessageChannel();

  const context: WorkerContext = {
    connections: new Set([channel.port2]),
    getSimulation: () => simulation,
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
