import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { tryReadCurrentUser } from './try-read-current-user';

test('it reports the anon reason when no session header is forwarded', async () => {
  const result = await tryReadCurrentUser({});

  expect(result).toStrictEqual({ authenticated: false, reason: 'missing-session' });
});

test('it reports the anon reason when the forwarded session id is unknown', async () => {
  const result = await tryReadCurrentUser({ authorization: 'Bearer does-not-exist' });

  expect(result).toStrictEqual({ authenticated: false, reason: 'missing-session' });
});

test('it returns the signed-in user for a live forwarded session', async () => {
  const user = await userCollection.create({
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    email: 'try-read-current-user@vers.test',
    id: createId(),
    name: 'Try Read Current User',
    seed: 0,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    username: 'try-read-current-user',
  });

  const sessionID = createId();

  await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: sessionID,
    ipAddress: '127.0.0.1',
    updatedAt: new Date(),
    userID: user.id,
    verified: true,
  });

  const result = await tryReadCurrentUser({ authorization: `Bearer ${sessionID}` });

  expect(result).toStrictEqual({ authenticated: true, user });
});
