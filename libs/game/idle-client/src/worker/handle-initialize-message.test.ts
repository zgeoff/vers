import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import type { InitializeMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { handleInitializeMessage } from './handle-initialize-message';
import type { WorkerContext } from './types';

function createContext(initialConnections: ReadonlyArray<MessagePort> = []): WorkerContext {
  const connections = new Set(initialConnections);

  let simulation: null | ReturnType<typeof createSimulation> = null;

  return {
    connections,
    getSimulation: () => simulation,
    removeConnection: (port) => {
      connections.delete(port);
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
  };
}

test('it initializes the simulation', async () => {
  const context = createContext();

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  await handleInitializeMessage(context, message);

  expect(context.getSimulation()).not.toBeNull();
});

test('it sends an initial state message to all connections', async () => {
  const channel = new MessageChannel();

  const context = createContext([channel.port2]);

  channel.port1.start();

  const received = new Promise<MessageEvent>((resolve) => {
    channel.port1.addEventListener('message', resolve, { once: true });
  });

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  await handleInitializeMessage(context, message);

  const event = await received;

  const simulation = context.getSimulation();

  expect(event.data).toStrictEqual({
    state: simulation?.getSnapshot(),
    type: WorkerMessageType.InitialState,
  });
});

test('it does not create a new simulation if one already exists', async () => {
  const context = createContext();
  const existingSimulation = createSimulation();

  context.setSimulation(existingSimulation);

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  await handleInitializeMessage(context, message);

  expect(context.getSimulation()).toBe(existingSimulation);
});
