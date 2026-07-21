import { expect, test } from 'bun:test';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
import { readFailureActionCache } from '../submission/read-failure-action-cache';
import type { ActivityServiceClient } from '../submission/types';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { ClientMessageType, WorkerMessageType } from '../types';
import type { SetFailureActionMessage } from './client-to-worker-message-schema';
import { handleSetFailureActionMessage } from './handle-set-failure-action-message';

interface SetupTestConfig {
  readonly userID: string;
}

/**
 * Builds an authed client acting as the given user, so the handler's push hits the same state
 * transitions the real service applies to the avatar rows the test seeds in the mock db.
 */
async function setupTest(config: Readonly<SetupTestConfig>) {
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', config.userID);

  return { client };
}

test('it forwards the change to a live simulation instead of dropping it', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const simulation = createSimulation();
  const context = createStubWorkerContext({ client: ctx.client });

  context.setSimulation(simulation);

  const message: SetFailureActionMessage = {
    avatarID: viewer.avatar.id,
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  await handleSetFailureActionMessage(context, message);

  expect(simulation.failureAction).toBe(ActivityFailureAction.Retry);
});

test('it applies the change with no live simulation instead of warning and dropping it', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client });

  const message: SetFailureActionMessage = {
    avatarID: viewer.avatar.id,
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  await handleSetFailureActionMessage(context, message);

  expect(context.getFailureAction()).toBe(ActivityFailureAction.Retry);
});

test('it clears the dirty flag once the server push succeeds', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client });

  const message: SetFailureActionMessage = {
    avatarID: viewer.avatar.id,
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  await handleSetFailureActionMessage(context, message);

  expect(context.isFailureActionDirty()).toBeFalse();

  const cached = await readFailureActionCache();

  expect(cached).toStrictEqual({
    avatarID: viewer.avatar.id,
    dirty: false,
    failureAction: ActivityFailureAction.Retry,
  });
});

test('it keeps the dirty flag when the server push fails', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  server.use(
    mockActivityService.updateFailureAction.handler(() => {
      throw new Error('unreachable service');
    }),
  );

  const context = createStubWorkerContext({ client: ctx.client });

  const message: SetFailureActionMessage = {
    avatarID: viewer.avatar.id,
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  await handleSetFailureActionMessage(context, message);

  expect(context.isFailureActionDirty()).toBeTrue();

  const cached = await readFailureActionCache();

  expect(cached).toStrictEqual({
    avatarID: viewer.avatar.id,
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });
});

test('it broadcasts the effective failure action to every connection', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const channel = new MessageChannel();

  const context = createStubWorkerContext({ client: ctx.client, connections: [channel.port2] });

  channel.port1.start();

  const received = new Promise<MessageEvent>((resolve) => {
    channel.port1.addEventListener('message', resolve, { once: true });
  });

  const message: SetFailureActionMessage = {
    avatarID: viewer.avatar.id,
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
