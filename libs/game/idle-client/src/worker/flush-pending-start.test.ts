import { expect, test } from 'bun:test';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import type { ActivityServiceClient } from '../submission/types';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import { WorkerMessageType } from '../types';
import { flushPendingStart } from './flush-pending-start';

test('it reports none when no start is held', async () => {
  const context = createStubWorkerContext();

  const outcome = await flushPendingStart(context);

  expect(outcome).toBe('none');
});

test('it mints the row and releases the intent', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client });

  await writePendingStartIntent({
    avatarID: viewer.avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_1',
  });

  const outcome = await flushPendingStart(context);

  expect(outcome).toBe('delivered');

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the delivery to mint a row');
  expect(minted.startKey).toBe('continue_activity_1');

  const intent = await readPendingStartIntent();

  expect(intent).toBeUndefined();
});

test('it holds the intent and broadcasts the cap while the offline budget is spent', async () => {
  const connection = createTestConnection();

  const context = createStubWorkerContext({
    connections: [connection.port],
    remainingBudgetMs: 0,
  });

  await writePendingStartIntent({
    avatarID: 'avatar_1',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_1',
  });

  const outcome = await flushPendingStart(context);

  expect(outcome).toBe('held');

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    { halted: true, remainingMs: 0, type: WorkerMessageType.OfflineCapStatus },
  ]);

  const intent = await readPendingStartIntent();

  expect(intent).toBeDefined();
});

test('it holds the intent while its own target row is still closing', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client });

  // the target's terminal append hasn't drained: the row still reads active and conflicts
  const closing = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  await writePendingStartIntent({
    avatarID: viewer.avatar.id,
    scopeID: closing.scopeID,
    scopeType: closing.scopeType,
    startKey: `continue_${closing.id}`,
  });

  const outcome = await flushPendingStart(context);

  expect(outcome).toBe('held');

  const intent = await readPendingStartIntent();

  expect(intent).toBeDefined();
});

test('it drops the intent when a foreign claim conflicts', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client });

  await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    startKey: 'someone-elses-start',
    status: 'active',
  });

  await writePendingStartIntent({
    avatarID: viewer.avatar.id,
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_gone',
  });

  const outcome = await flushPendingStart(context);

  expect(outcome).toBe('none');

  const intent = await readPendingStartIntent();

  expect(intent).toBeUndefined();
});

test('it drops an intent the service refuses', async () => {
  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.CHAIN_QUARANTINED({ data: {} });
    }),
  );

  const context = createStubWorkerContext();

  await writePendingStartIntent({
    avatarID: 'avatar_1',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_1',
  });

  const outcome = await flushPendingStart(context);

  expect(outcome).toBe('none');

  const intent = await readPendingStartIntent();

  expect(intent).toBeUndefined();
});

test('it holds the intent and reports offline on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const connection = createTestConnection();
  const context = createStubWorkerContext({ connections: [connection.port] });

  await writePendingStartIntent({
    avatarID: 'avatar_1',
    scopeID: 'a9lp75',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_1',
  });

  const outcome = await flushPendingStart(context);

  expect(outcome).toBe('held');

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    { online: false, type: WorkerMessageType.ConnectionStatus },
  ]);

  const intent = await readPendingStartIntent();

  expect(intent).toBeDefined();
});
