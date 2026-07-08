import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import * as db from '../../mocks/db';
import { withRequestContext } from '../../test-utils/with-request-context';
import { getAvatarContent } from './get-avatar-content';

test('it redirects to avatar creation when the caller has no avatar yet', async () => {
  const userID = createId();
  const sessionID = createId();

  await db.userCollection.create({ id: userID });

  await db.sessionCollection.create({ id: sessionID, userID });

  const outcome = await withRequestContext(
    { cookies: { en_session: { accessToken: sessionID, refreshToken: 'refresh', sessionID } } },
    () =>
      getAvatarContent()
        .then(() => null)
        .catch((error: unknown) => (isRedirect(error) ? error.options.href : null)),
  );

  expect(outcome.value).toBe('/avatar/create');
});
