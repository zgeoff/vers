import { expect, test } from 'bun:test';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import type { ActivityServiceClient } from '../submission/types';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { submitStopIntent } from './submit-stop-intent';

test('it delivers the targeted stop and leaves no intent held', async () => {
  const viewer = await createViewer();
  const row = await db.activityCollection.create({ avatarID: viewer.avatar.id, status: 'active' });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client });

  await submitStopIntent(context, row);

  const stopped = db.activityCollection.findFirst((q) => q.where({ id: row.id }));

  invariant(stopped !== undefined, 'expected the targeted row to survive');
  expect(stopped.status).toBe('stopped');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it keeps the intent held when delivery fails', async () => {
  server.use(mockActivityService.stopActivity.handler(() => HttpResponse.error()));

  const context = createStubWorkerContext();

  await submitStopIntent(context, { avatarID: 'avatar_1', id: 'activity_1' });

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({ activityID: 'activity_1', avatarID: 'avatar_1' });
});
