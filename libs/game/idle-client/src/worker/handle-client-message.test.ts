import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
import { createMockWorkerContext } from '../test-utils/factories/create-mock-worker-context';
import type {
  DisconnectMessage,
  InitializeMessage,
  RequestResyncMessage,
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

  const simulation = createSimulation();

  context.setSimulation(simulation);

  const activity = createMockActivityData();

  const message: SetActivityMessage = {
    activity,
    type: ClientMessageType.SetActivity,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(simulation.activity?.id).toBe(activity.id);
  expect(simulation.avatar?.id).toBe(activity.avatarID);
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

test('it handles request resync messages', async () => {
  server.use(
    mockActivityService.getLatestActivityProgress.handler((opts) => {
      throw opts.errors.NOT_FOUND({ data: {} });
    }),
  );

  const context = createMockWorkerContext();

  const channel = new MessageChannel();

  const message: RequestResyncMessage = {
    avatarID: 'avatar_1',
    type: ClientMessageType.RequestResync,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.getResyncAvatarID()).toBe('avatar_1');
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
