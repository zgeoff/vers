import { expect, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { createTestAccessToken, resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { server } from '../mocks/node';
import { readFailureActionCache } from '../submission/read-failure-action-cache';
import type { ActivityServiceClient } from '../submission/types';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import type { SetFailureActionMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { handleSetFailureActionMessage } from './handle-set-failure-action-message';

async function setupTest() {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const token = await createTestAccessToken(user.id);

  const client: ActivityServiceClient = createORPCClient(
    new RPCLink({
      headers: { authorization: `Bearer ${token}` },
      url: `${resolveServiceURL('activity')}/rpc`,
    }),
  );

  return { avatar, client };
}

test('it forwards the change to a live simulation instead of dropping it', async () => {
  const ctx = await setupTest();

  const simulation = createSimulation();
  const context = createStubWorkerContext({ client: ctx.client });

  context.setSimulation(simulation);
  context.setResyncAvatarID(ctx.avatar.id);

  const message: SetFailureActionMessage = {
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  await handleSetFailureActionMessage(context, message);

  expect(simulation.failureAction).toBe(ActivityFailureAction.Retry);
});

test('it applies the change with no live simulation instead of warning and dropping it', async () => {
  const ctx = await setupTest();

  const context = createStubWorkerContext({ client: ctx.client });

  context.setResyncAvatarID(ctx.avatar.id);

  const message: SetFailureActionMessage = {
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  await handleSetFailureActionMessage(context, message);

  expect(context.getFailureAction()).toBe(ActivityFailureAction.Retry);
});

test('it clears the dirty flag once the server push succeeds', async () => {
  const ctx = await setupTest();

  const context = createStubWorkerContext({ client: ctx.client });

  context.setResyncAvatarID(ctx.avatar.id);

  const message: SetFailureActionMessage = {
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  await handleSetFailureActionMessage(context, message);

  expect(context.isFailureActionDirty()).toBeFalse();

  const cached = await readFailureActionCache();

  expect(cached).toStrictEqual({ dirty: false, failureAction: ActivityFailureAction.Retry });
});

test('it keeps the dirty flag when the server push fails', async () => {
  const ctx = await setupTest();

  server.use(
    mockActivityService.updateFailureAction.handler(() => {
      throw new Error('unreachable service');
    }),
  );

  const context = createStubWorkerContext({ client: ctx.client });

  context.setResyncAvatarID(ctx.avatar.id);

  const message: SetFailureActionMessage = {
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  await handleSetFailureActionMessage(context, message);

  expect(context.isFailureActionDirty()).toBeTrue();

  const cached = await readFailureActionCache();

  expect(cached).toStrictEqual({ dirty: true, failureAction: ActivityFailureAction.Retry });
});

test('it broadcasts the effective failure action to every connection', async () => {
  const ctx = await setupTest();

  const channel = new MessageChannel();

  const context = createStubWorkerContext({ client: ctx.client, connections: [channel.port2] });

  context.setResyncAvatarID(ctx.avatar.id);
  channel.port1.start();

  const received = new Promise<MessageEvent>((resolve) => {
    channel.port1.addEventListener('message', resolve, { once: true });
  });

  const message: SetFailureActionMessage = {
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  await handleSetFailureActionMessage(context, message);

  const event = await received;

  expect(event.data).toStrictEqual({
    failureAction: ActivityFailureAction.Retry,
    type: WorkerMessageType.FailureActionStatus,
  });
});
