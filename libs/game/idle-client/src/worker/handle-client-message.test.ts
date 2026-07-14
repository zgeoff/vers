import { expect, test } from 'bun:test';
import {
  ActivityFailureAction,
  createMockActivityInput,
  createMockAvatarData,
  createSimulation,
} from '@vers/idle-core';
import { createMockWorkerContext } from '../test-utils/factories/create-mock-worker-context';
import type {
  DisconnectMessage,
  InitializeMessage,
  SetActivityMessage,
  SetFailureActionMessage,
} from '../types';
import { ClientMessageType } from '../types';
import { handleClientMessage } from './handle-client-message';

test('it handles initialization messages', async () => {
  const context = createMockWorkerContext();

  const channel = new MessageChannel();

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.getSimulation()).not.toBeNull();
});

test('it handles setting the activity', async () => {
  const context = createMockWorkerContext();

  const channel = new MessageChannel();

  const avatar = createMockAvatarData();
  const simulation = createSimulation();

  context.setSimulation(simulation);

  const activity = createMockActivityInput();

  const message: SetActivityMessage = {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(simulation.activity?.id).toBe(activity.id);
  expect(simulation.avatar?.id).toBe(avatar.id);
});

test('it handles setting the failure action', async () => {
  const context = createMockWorkerContext();

  const channel = new MessageChannel();

  const simulation = createSimulation();

  context.setSimulation(simulation);

  const message: SetFailureActionMessage = {
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(simulation.failureAction).toBe(ActivityFailureAction.Retry);
});

test('it handles disconnect messages', async () => {
  const channel = new MessageChannel();

  const context = createMockWorkerContext({ connections: [channel.port2] });

  const message: DisconnectMessage = {
    type: ClientMessageType.Disconnect,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.connections.has(channel.port2)).toBeFalse();
});
