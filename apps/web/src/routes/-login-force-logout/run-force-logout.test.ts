import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import * as db from '@vers/mock-services/db';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { runForceLogout } from './run-force-logout';

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
      const promise = runForceLogout(buildFormData({ intent: 'cancel' }));

      await expect(promise).rejects.toMatchObject({ options: { href: '/' } });
    },
  );

  expect(outcome.cookies['en_verification']).toStrictEqual({});
});

test('it redirects home without acting when there is no pending session to confirm', async () => {
  const promise = withRequestContext({}, () =>
    runForceLogout(buildFormData({ intent: 'confirm' })),
  );

  await expect(promise).rejects.toMatchObject({ options: { href: '/' } });
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
      const promise = runForceLogout(buildFormData({ intent: 'confirm' }));

      await expect(promise).rejects.toMatchObject({ options: { href: '/respite' } });
    },
  );

  expect(outcome.cookies['en_verification']).toStrictEqual({});
  expect(outcome.cookies['en_session']).toContainKeys(['accessToken', 'refreshToken', 'sessionID']);
  expect(db.sessionCollection.findFirst((q) => q.where({ id: otherSessionID }))).toBeUndefined();
  expect(db.sessionCollection.findFirst((q) => q.where({ id: pendingSessionID }))).toBeDefined();
});

test('it honors a stashed redirect target on confirm', async () => {
  const userID = createId();
  const pendingSessionID = createId();

  await db.sessionCollection.create({ id: pendingSessionID, userID, verified: false });

  const promise = withRequestContext(
    {
      cookies: {
        en_verification: {
          'loginLogout#email': 'force-logout-redirect@vers.test',
          'loginLogout#redirect': '/nexus',
          'loginLogout#sessionID': pendingSessionID,
          'loginLogout#userID': userID,
        },
      },
    },
    () => runForceLogout(buildFormData({ intent: 'confirm' })),
  );

  await expect(promise).rejects.toMatchObject({ options: { href: '/nexus' } });
});
