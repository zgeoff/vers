import { expect, onTestFinished, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { waitFor } from '@vers/test-utils';
import { server } from '../mocks/node';
import type { TestConnection } from '../test-utils/create-test-connection';
import { createTestConnection } from '../test-utils/create-test-connection';
import { ClientMessageType, WorkerMessageType } from '../types';
import { createWorkerRuntime } from './create-worker-runtime';
import type { WorkerRuntime } from './create-worker-runtime';

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
