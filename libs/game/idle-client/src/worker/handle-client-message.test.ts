import { expect, test } from 'bun:test';
import {
  ActivityFailureAction,
  createMockActivityData,
  createMockAvatarData,
  createSimulation,
} from '@vers/idle-core';
import xxhash from 'xxhash-wasm';
import type {
  DisconnectMessage,
  InitializeMessage,
  SetActivityMessage,
  SetFailureActionMessage,
} from '../types';
import { ClientMessageType } from '../types';
import { handleClientMessage } from './handle-client-message';
import type { WorkerContext } from './types';

const hasher = await xxhash();

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

test('it handles initialization messages', async () => {
  const context = createContext();

  const channel = new MessageChannel();

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.getSimulation()).not.toBeNull();
});

test('it handles setting the activity', async () => {
  const context = createContext();

  const channel = new MessageChannel();

  const avatar = createMockAvatarData();
  const simulation = createSimulation(hasher);

  context.setSimulation(simulation);

  const activity = createMockActivityData();

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
  const context = createContext();

  const channel = new MessageChannel();

  const simulation = createSimulation(hasher);

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

  const context = createContext([channel.port2]);

  const message: DisconnectMessage = {
    type: ClientMessageType.Disconnect,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.connections.has(channel.port2)).toBeFalse();
});
