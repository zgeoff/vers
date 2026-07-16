import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import { createMockWorkerContext } from '../test-utils/factories/create-mock-worker-context';
import type { InitializeMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { handleInitializeMessage } from './handle-initialize-message';

test('it initializes the simulation', () => {
  const context = createMockWorkerContext();

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  handleInitializeMessage(context, message);
  expect(context.getSimulation()).not.toBeNull();
});

test('it sends an initial state message to all connections', async () => {
  const channel = new MessageChannel();

  const context = createMockWorkerContext({ connections: [channel.port2] });

  channel.port1.start();

  const received = new Promise<MessageEvent>((resolve) => {
    channel.port1.addEventListener('message', resolve, { once: true });
  });

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  handleInitializeMessage(context, message);

  const event = await received;

  const simulation = context.getSimulation();

  expect(event.data).toStrictEqual({
    rewardSlotLedger: { activityID: null, entries: [] },
    state: simulation?.getSnapshot(),
    type: WorkerMessageType.InitialState,
  });
});

test('it sends the retained reward-slot ledger to a connection that initializes mid-run', async () => {
  const channel = new MessageChannel();

  const context = createMockWorkerContext({ connections: [channel.port2] });

  context.setSimulation(createSimulation());
  context.recordRewardSlots('activity_1', { count: 2, version: 1 });
  channel.port1.start();

  const received = new Promise<MessageEvent>((resolve) => {
    channel.port1.addEventListener('message', resolve, { once: true });
  });

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  handleInitializeMessage(context, message);

  const event = await received;

  expect(event.data).toStrictEqual({
    rewardSlotLedger: { activityID: 'activity_1', entries: [{ count: 2, version: 1 }] },
    state: context.getSimulation()?.getSnapshot(),
    type: WorkerMessageType.InitialState,
  });
});

test('it does not create a new simulation if one already exists', () => {
  const context = createMockWorkerContext();
  const existingSimulation = createSimulation();

  context.setSimulation(existingSimulation);

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  handleInitializeMessage(context, message);
  expect(context.getSimulation()).toBe(existingSimulation);
});
