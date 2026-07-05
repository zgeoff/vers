import { postMessageAndWaitForReply } from '@vers/client-test-utils';
import { createMockActivityData, createMockAvatarData } from '@vers/idle-core';
import { expect, test } from 'vitest';
import type { InitializeMessage, SetActivityMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import SimulationWorker from './worker.ts?sharedworker';

test('it sends the initial state', async () => {
  const worker = new SimulationWorker();

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  const event = await postMessageAndWaitForReply(worker, message);

  expect(event.data.type).toBe(WorkerMessageType.InitialState);
});

test('it processes simulation updates', async () => {
  const worker = new SimulationWorker();

  const initializeMessage: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  const activity = createMockActivityData();
  const avatar = createMockAvatarData();

  const setActivityMessage: SetActivityMessage = {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };

  await postMessageAndWaitForReply(worker, initializeMessage);

  const event = await postMessageAndWaitForReply(worker, setActivityMessage);

  expect(event.data.type).toBe(WorkerMessageType.SimulationUpdate);
});
