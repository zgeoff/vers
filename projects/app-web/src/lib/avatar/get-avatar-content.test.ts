import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { getAvatarContent } from './get-avatar-content';

/**
 * The success path calls into the Flight pipeline, which resolves to a client-build stub that
 * unconditionally throws under `bun test` (no `react-server` export condition) — see
 * `get-account-content.tsx`'s own comment. Only the redirect branch, which returns before that
 * call, is covered here; the smoke suite covers the rest.
 */
test('it redirects to avatar creation when the caller has no avatar yet', async () => {
  const userID = createId();
  const sessionID = createId();

  await userCollection.create({
    createdAt: new Date(),
    email: 'get-avatar-content@vers.test',
    id: userID,
    name: 'Get Avatar Content',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'get-avatar-content',
  });

  await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: sessionID,
    ipAddress: '127.0.0.1',
    previousRefreshToken: null,
    refreshToken: null,
    updatedAt: new Date(),
    userID,
    verified: true,
  });

  const outcome = await withRequestContext(
    { cookies: { en_session: { accessToken: sessionID, refreshToken: 'refresh', sessionID } } },
    () =>
      getAvatarContent()
        .then(() => null)
        .catch((error: unknown) => (isRedirect(error) ? error.options.href : null)),
  );

  expect(outcome.value).toBe('/avatar/create');
});
