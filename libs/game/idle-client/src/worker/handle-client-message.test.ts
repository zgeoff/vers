import { expect, test } from 'bun:test';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import { HttpResponse } from 'msw';
import { server } from '../mocks/node';
import type { ActivityServiceClient } from '../submission/types';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import type {
  DisconnectMessage,
  InitializeMessage,
  RequestResyncMessage,
  SetFailureActionMessage,
  StartActivityMessage,
} from '../types';
import { ClientMessageType } from '../types';
import { handleClientMessage } from './handle-client-message';

test('it installs a simulation on an initialize message', async () => {
  const context = createStubWorkerContext();

  const channel = new MessageChannel();

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);
});

test('it applies the sent failure action to the live simulation', async () => {
  const context = createStubWorkerContext();

  const channel = new MessageChannel();

  const simulation = createSimulation();

  context.setSimulation(simulation);

  const message: SetFailureActionMessage = {
    avatarID: 'avatar-1',
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(simulation.failureAction).toBe(ActivityFailureAction.Retry);
});

test('it records the resync request for the requested avatar', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client });

  const channel = new MessageChannel();

  const message: RequestResyncMessage = {
    avatarID: viewer.avatar.id,
    claim: false,
    type: ClientMessageType.RequestResync,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.getResyncAvatarID()).toBe(viewer.avatar.id);
});

test('it drops the connection on a disconnect message', async () => {
  const channel = new MessageChannel();

  const context = createStubWorkerContext({ connections: [channel.port2] });

  const message: DisconnectMessage = {
    type: ClientMessageType.Disconnect,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.connections.has(channel.port2)).toBeFalse();
});

test('it routes a start activity message and claims the request', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const channel = new MessageChannel();

  const context = createStubWorkerContext();

  const message: StartActivityMessage = {
    avatarID: 'avatar_1',
    requestID: 'request_1',
    scopeID: 'scope_1',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.getStartRequestID()).toBe('request_1');
});
