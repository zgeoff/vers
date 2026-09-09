import { expect, test } from 'bun:test';
import { createViewer } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import { server } from '../mocks/node';
import { createActivityServiceClient } from '../submission/create-activity-service-client';
import { createStubActivityProxy } from './create-stub-activity-proxy';

test('it answers the proxy path as the given user', async () => {
  const viewer = await createViewer();
  const activity = await db.activityCollection.create({ avatarID: viewer.avatar.id });

  server.use(createStubActivityProxy(viewer.user.id));

  const client = createActivityServiceClient();

  expect(client.getCurrentActivity({ avatarID: viewer.avatar.id })).resolves.toMatchObject({
    id: activity.id,
  });
});

test("it hides another user's avatar from the given user", async () => {
  const viewer = await createViewer();
  const other = await createViewer();

  await db.activityCollection.create({ avatarID: other.avatar.id });

  server.use(createStubActivityProxy(viewer.user.id));

  const client = createActivityServiceClient();

  expect(client.getCurrentActivity({ avatarID: other.avatar.id })).resolves.toBeNull();
});
