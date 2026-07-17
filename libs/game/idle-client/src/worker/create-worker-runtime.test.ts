import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { waitFor } from '@vers/test-utils';
import { server } from '../mocks/node';
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

test('it broadcasts a simulation update once an activity is set', async () => {
  server.use(mockActivityService.trackActivityProgress.handler(() => ({ appendedHead: 0 })));

  const runtime = createWorkerRuntime();

  onTestFinished(() => {
    runtime.stop();
  });

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(1);

  connection.post({
    activity: createMockActivityData(),
    type: ClientMessageType.SetActivity,
  });

  await connection.waitForMessages(2);

  expect(connection.received[1]?.type).toBe(WorkerMessageType.SimulationUpdate);
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

  await survivor.waitForMessages(1);

  expect(runtime.connections.size).toBe(2);

  leaving.post({ type: ClientMessageType.Disconnect });

  await waitFor(() => {
    expect(runtime.connections.size).toBe(1);
  });

  survivor.post({
    activity: createMockActivityData(),
    type: ClientMessageType.SetActivity,
  });

  await survivor.waitForMessages(2);

  expect(survivor.received[1]?.type).toBe(WorkerMessageType.SimulationUpdate);
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
