import { expect, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { createTestAccessToken, resolveServiceURL } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import type { ActivityServiceClient } from '../submission/types';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import type {
  DisconnectMessage,
  InitializeMessage,
  RequestFlushMessage,
  RequestResyncMessage,
  SetActivityMessage,
  SetFailureActionMessage,
} from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { handleClientMessage } from './handle-client-message';

test('it installs a simulation on an initialize message', async () => {
  const context = createStubWorkerContext();

  const channel = new MessageChannel();

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.getSimulation()).not.toBeNull();
});

test('it starts the sent activity on the live simulation', async () => {
  const context = createStubWorkerContext();

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
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });

  const client: ActivityServiceClient = createORPCClient(
    new RPCLink({
      headers: { authorization: `Bearer ${await createTestAccessToken(user.id)}` },
      url: `${resolveServiceURL('activity')}/rpc`,
    }),
  );

  const context = createStubWorkerContext({ client });

  const channel = new MessageChannel();

  const message: RequestResyncMessage = {
    avatarID: avatar.id,
    type: ClientMessageType.RequestResync,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, channel.port2, event);

  expect(context.getResyncAvatarID()).toBe(avatar.id);
});

test('it acks a request flush message back to the sending port', async () => {
  const connection = createTestConnection();
  const context = createStubWorkerContext({ connections: [connection.port] });

  const message: RequestFlushMessage = {
    activityID: 'activity_1',
    requestID: 'request_1',
    type: ClientMessageType.RequestFlush,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(context, connection.port, event);

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    { activityID: 'activity_1', requestID: 'request_1', type: WorkerMessageType.FlushCompleted },
  ]);
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
