import { expect, onTestFinished, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ErrorEvent } from '@sentry/browser';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityFailureAction } from '@vers/idle-core';
import { createTestAccessToken, resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { waitFor } from '@vers/test-utils';
import { server } from '../mocks/node';
import type { ActivityServiceClient } from '../submission/types';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import type { TestConnection } from '../test-utils/create-test-connection';
import { createTestConnection } from '../test-utils/create-test-connection';
import { ClientMessageType, WorkerMessageType } from '../types';
import { createWorkerRuntime } from './create-worker-runtime';
import type { WorkerRuntime } from './create-worker-runtime';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

function createConnection(runtime: WorkerRuntime): TestConnection {
  const connection = createTestConnection();

  runtime.handleConnect(new MessageEvent('connect', { ports: [connection.port] }));

  return connection;
}

test('it replies with the initial state to an initialize message', async () => {
  const runtime = createWorkerRuntime();

  onTestFinished(() => {
    runtime.stop();
  });

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(1);

  expect(connection.received[0]?.type).toBe(WorkerMessageType.InitialState);
});

test('it seeds the boot state from the device-local failure-action cache before the first message runs', async () => {
  await writeFailureActionCache({
    avatarID: 'seeded-avatar',
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });

  const runtime = createWorkerRuntime();

  onTestFinished(() => {
    runtime.stop();
  });

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(2);

  expect(connection.received[1]).toStrictEqual({
    failureAction: ActivityFailureAction.Retry,
    type: WorkerMessageType.FailureActionStatus,
  });
});

test('it retains the cached dirty flag across boot so the next resync flushes it to the server', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: avatar.id,
    startedAt: new Date(),
  });

  await writeFailureActionCache({
    avatarID: avatar.id,
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });

  const token = await createTestAccessToken(user.id);

  // the runtime's production client resolves its URL from `self.location.origin`, unreachable in
  // this test env — an authed client wired at the mocked backend is the only way to route its
  // calls, standing in for it here the way `timestep` already stands in for the tick rate
  const client: ActivityServiceClient = createORPCClient(
    new RPCLink({
      headers: { authorization: `Bearer ${token}` },
      url: `${resolveServiceURL('activity')}/rpc`,
    }),
  );

  const runtime = createWorkerRuntime({ client });

  onTestFinished(() => {
    runtime.stop();
  });

  const connection = createConnection(runtime);

  connection.post({ avatarID: avatar.id, type: ClientMessageType.RequestResync });

  await waitFor(() => {
    const updatedAvatar = db.avatarCollection.findFirst((q) => q.where({ id: avatar.id }));

    expect(updatedAvatar?.failureAction).toBe('retry');
  });
});

test('it broadcasts a simulation update once an activity is set', async () => {
  server.use(mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 0 })));

  const runtime = createWorkerRuntime();

  onTestFinished(() => {
    runtime.stop();
  });

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(2);

  connection.post({
    activity: createMockActivityData(),
    type: ClientMessageType.SetActivity,
  });

  await connection.waitForMessages(3);

  expect(connection.received[2]?.type).toBe(WorkerMessageType.SimulationUpdate);
});

test('it stops broadcasting to a connection after it disconnects', async () => {
  server.use(mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 0 })));

  const runtime = createWorkerRuntime();

  onTestFinished(() => {
    runtime.stop();
  });

  const survivor = createConnection(runtime);
  const leaving = createConnection(runtime);

  survivor.post({ type: ClientMessageType.Initialize });

  await survivor.waitForMessages(2);

  expect(runtime.connections.size).toBe(2);

  leaving.post({ type: ClientMessageType.Disconnect });

  await waitFor(() => {
    expect(runtime.connections.size).toBe(1);
  });

  survivor.post({
    activity: createMockActivityData(),
    type: ClientMessageType.SetActivity,
  });

  await survivor.waitForMessages(3);

  expect(survivor.received[2]?.type).toBe(WorkerMessageType.SimulationUpdate);
});

test('it reports a fault to the error backend when a message makes its handler throw', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const runtime = createWorkerRuntime();

  onTestFinished(() => {
    runtime.stop();
  });

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(1);

  // a version-skewed tab can post an activity shape this worker build cannot derive a simulation
  // input from — the handler's throw must land in the error backend, not vanish into the void'd
  // routing promise
  connection.postRaw({
    activity: { ...createMockActivityData(), buildSnapshot: undefined },
    type: ClientMessageType.SetActivity,
  });

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ site: 'message-routing' });
});
