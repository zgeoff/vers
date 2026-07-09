import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import * as db from '../../mocks/db';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { forceLogoutHandler } from './force-logout-handler';

test('it clears the pending session and redirects home on cancel', async () => {
  const outcome = await withRequestContext(
    {
      cookies: {
        en_verification: {
          'loginLogout#email': 'x@vers.test',
          'loginLogout#sessionID': 'session-1',
        },
      },
    },
    async () => {
      const redirectHref = await forceLogoutHandler(buildFormData({ intent: 'cancel' }))
        .then(() => null)
        .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

      return redirectHref;
    },
  );

  expect(outcome.value).toBe('/');
  expect(outcome.cookies['en_verification']).toStrictEqual({});
});

test('it redirects home without acting when there is no pending session to confirm', async () => {
  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await forceLogoutHandler(buildFormData({ intent: 'confirm' }))
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/');
});

test('it signs out every other live session and completes sign-in on confirm', async () => {
  const userID = createId();
  const pendingSessionID = createId();
  const otherSessionID = createId();

  await db.sessionCollection.create({ id: pendingSessionID, userID, verified: false });

  await db.sessionCollection.create({ id: otherSessionID, userID });

  const outcome = await withRequestContext(
    {
      cookies: {
        en_verification: {
          'loginLogout#email': 'force-logout-confirm@vers.test',
          'loginLogout#sessionID': pendingSessionID,
          'loginLogout#userID': userID,
        },
      },
    },
    async () => {
      const redirectHref = await forceLogoutHandler(buildFormData({ intent: 'confirm' }))
        .then(() => null)
        .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

      return redirectHref;
    },
  );

  expect(outcome.value).toBe('/');
  expect(outcome.cookies['en_verification']).toStrictEqual({});
  expect(outcome.cookies['en_session']).toContainKeys(['accessToken', 'refreshToken', 'sessionID']);
  expect(db.sessionCollection.findFirst((q) => q.where({ id: otherSessionID }))).toBeUndefined();
  expect(db.sessionCollection.findFirst((q) => q.where({ id: pendingSessionID }))).toBeDefined();
});
