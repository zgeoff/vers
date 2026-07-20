import { expect, test } from 'bun:test';
import * as jose from 'jose';
import { createViewer } from './create-viewer';
import { avatarCollection, userCollection } from './db';

test('it seeds a linked user and avatar and mints a token for that user', async () => {
  const viewer = await createViewer();

  expect(viewer.avatar.userID).toBe(viewer.user.id);
  expect(jose.decodeJwt(viewer.token).sub).toBe(viewer.user.id);

  expect(userCollection.findFirst((q) => q.where({ id: viewer.user.id }))).toMatchObject({
    id: viewer.user.id,
  });

  expect(avatarCollection.findFirst((q) => q.where({ id: viewer.avatar.id }))).toMatchObject({
    userID: viewer.user.id,
  });
});

test('it applies user and avatar overrides', async () => {
  const viewer = await createViewer({
    avatar: { name: 'viewer-override-avatar' },
    user: { email: 'viewer-override@test.com' },
  });

  expect(viewer.user.email).toBe('viewer-override@test.com');
  expect(viewer.avatar.name).toBe('viewer-override-avatar');
});
