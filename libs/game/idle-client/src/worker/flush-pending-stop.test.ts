import { expect, mock, test } from 'bun:test';
import { createAuthedServiceClient } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import type { ActivityServiceClient } from '../submission/types';
import { writePendingStopIntent } from '../submission/write-pending-stop-intent';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { flushPendingStop } from './flush-pending-stop';

function buildSpySubmitter(): CheckpointSubmitter {
  return {
    flushHeld: mock(() => Promise.resolve()),
    flushNow: mock(() => Promise.resolve()),
    registerActivity: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve<number | undefined>(undefined)),
  };
}

test('it reports none when no stop is held', async () => {
  const submitter = buildSpySubmitter();
  const context = createStubWorkerContext({ submitter });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('none');
  expect(submitter.flushNow).not.toHaveBeenCalled();
});

test('it flushes the queue, stops the row, and releases the intent', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const activity = await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', user.id);

  const submitter = buildSpySubmitter();
  const context = createStubWorkerContext({ client, submitter });

  await writePendingStopIntent({ activityID: activity.id, avatarID: avatar.id });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('delivered');
  expect(submitter.flushNow).toHaveBeenCalledExactlyOnceWith(activity.id);

  const row = db.activityCollection.findFirst((q) => q.where({ id: activity.id }));

  invariant(row !== undefined, 'expected the targeted row to survive');
  expect(row.status).toBe('stopped');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it treats a missing row as delivered and releases the intent', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', user.id);

  const context = createStubWorkerContext({ client, submitter: buildSpySubmitter() });

  await writePendingStopIntent({ activityID: 'activity_gone', avatarID: avatar.id });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('delivered');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it never touches a row other than the targeted one', async () => {
  const user = await db.userCollection.create({});
  const avatar = await db.avatarCollection.create({ userID: user.id });
  const ended = await db.activityCollection.create({ avatarID: avatar.id, status: 'stopped' });
  const newer = await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', user.id);

  const context = createStubWorkerContext({ client, submitter: buildSpySubmitter() });

  await writePendingStopIntent({ activityID: ended.id, avatarID: avatar.id });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('delivered');

  const survivor = db.activityCollection.findFirst((q) => q.where({ id: newer.id }));

  invariant(survivor !== undefined, 'expected the newer row to survive');
  expect(survivor.status).toBe('active');
});

test('it keeps the intent held on a transport failure', async () => {
  server.use(mockActivityService.stopActivity.handler(() => HttpResponse.error()));

  const context = createStubWorkerContext({ submitter: buildSpySubmitter() });

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
  const context = createStubWorkerContext({ submitter: buildSpySubmitter() });

  await writePendingStopIntent({ activityID: 'activity_1', avatarID: 'avatar_1' });

  const outcome = await flushPendingStop(context);

  expect(outcome).toBe('undelivered');

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
  });
});
