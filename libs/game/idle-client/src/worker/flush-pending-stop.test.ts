import { expect, test } from 'bun:test';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import type { ActivityServiceClient } from '../submission/types';
import { writePendingStopIntent } from '../submission/write-pending-stop-intent';
import { writeQueuedCheckpoint } from '../submission/write-queued-checkpoint';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { flushPendingStop } from './flush-pending-stop';

test('it reports none when no stop is held', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('none');
  expect(submitter.flushNow).not.toHaveBeenCalled();
});

test('it flushes the queue, stops the row, and releases the intent', async () => {
  const viewer = await createViewer();

  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client, submitter });

  await writePendingStopIntent({ activityID: activity.id, avatarID: viewer.avatar.id });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('delivered');
  expect(submitter.flushNow).toHaveBeenCalledExactlyOnceWith(activity.id);

  const row = db.activityCollection.findFirst((query) => query.where({ id: activity.id }));

  invariant(row !== undefined, 'expected the targeted row to survive');

  expect(row.status).toBe('stopped');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it delivers the queue a worker before a reload left for the stopped row before it stops the row', async () => {
  const viewer = await createViewer();

  const activity = await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createCheckpointSubmitter({ client, onInvalid: () => {} });
  const context = createStubWorkerContext({ client, submitter });

  await writeQueuedCheckpoint(
    activity.id,
    createMockCheckpointBatchEntry({ hash: 'hash_1', prevHash: activity.lastHash, version: 1 }),
  );

  await writeQueuedCheckpoint(
    activity.id,
    createMockCheckpointBatchEntry({ hash: 'hash_2', prevHash: 'hash_1', version: 2 }),
  );

  await writePendingStopIntent({ activityID: activity.id, avatarID: viewer.avatar.id });

  const outcome = await flushPendingStop(context);

  const row = db.activityCollection.findFirst((query) => query.where({ id: activity.id }));

  const remaining = await readQueuedCheckpoints(activity.id);

  invariant(row !== undefined, 'expected the stopped row to survive');

  expect(outcome).toBe('delivered');
  expect(row.appendedHead).toBe(2);
  expect(row.status).toBe('stopped');
  expect(remaining).toStrictEqual([]);
});

test('it keeps the row open, the intent, and the queue when the queue a reload left cannot be delivered', async () => {
  server.use(mockActivityService.trackActivityProgress.handler(() => HttpResponse.error()));

  const viewer = await createViewer();

  const activity = await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createCheckpointSubmitter({ client, onInvalid: () => {} });
  const context = createStubWorkerContext({ client, submitter });
  const queued = createMockCheckpointBatchEntry({ prevHash: activity.lastHash, version: 1 });

  await writeQueuedCheckpoint(activity.id, queued);
  await writePendingStopIntent({ activityID: activity.id, avatarID: viewer.avatar.id });

  const outcome = await flushPendingStop(context);

  const row = db.activityCollection.findFirst((query) => query.where({ id: activity.id }));

  const intent = await readPendingStopIntent();
  const remaining = await readQueuedCheckpoints(activity.id);

  expect(outcome).toBe('undelivered');
  expect(row?.status).toBe('active');
  expect(intent).toStrictEqual({ activityID: activity.id, avatarID: viewer.avatar.id });
  expect(remaining).toStrictEqual([{ ...queued, activityID: activity.id }]);
});

test('it treats a missing row as delivered and releases the intent', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  await writePendingStopIntent({ activityID: 'activity_gone', avatarID: viewer.avatar.id });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('delivered');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it never touches a row other than the targeted one', async () => {
  const viewer = await createViewer();

  const ended = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'stopped',
  });

  const newer = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  await writePendingStopIntent({ activityID: ended.id, avatarID: viewer.avatar.id });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('delivered');

  const survivor = db.activityCollection.findFirst((query) => query.where({ id: newer.id }));

  invariant(survivor !== undefined, 'expected the newer row to survive');

  expect(survivor.status).toBe('active');
});

test('it keeps the intent held on a transport failure', async () => {
  server.use(mockActivityService.stopActivity.handler(() => HttpResponse.error()));

  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  await writePendingStopIntent({ activityID: 'activity_1', avatarID: 'avatar_1' });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('undelivered');

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
  });
});

test('it keeps the intent held when the session is not recognized', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  await writePendingStopIntent({ activityID: 'activity_1', avatarID: 'avatar_1' });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('undelivered');

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
  });
});

test('it releases a stop another writer superseded, leaving the row active', async () => {
  const viewer = await createViewer();

  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client, submitter });

  server.use(
    mockActivityService.stopActivity.handler((opts) => {
      throw opts.errors.SESSION_EVICTED({ data: {} });
    }),
  );

  await writePendingStopIntent({ activityID: activity.id, avatarID: viewer.avatar.id });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('delivered');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();

  const row = db.activityCollection.findFirst((query) => query.where({ id: activity.id }));

  invariant(row !== undefined, 'expected the targeted row to survive');

  expect(row.status).toBe('active');
});
