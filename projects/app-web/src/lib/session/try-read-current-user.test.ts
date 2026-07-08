import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import * as db from '../../mocks/db';
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
  const user = await db.userCollection.create({});

  const sessionID = createId();

  await db.sessionCollection.create({ id: sessionID, userID: user.id });

  const result = await tryReadCurrentUser({ authorization: `Bearer ${sessionID}` });

  expect(result).toStrictEqual({
    authenticated: true,
    user: {
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      name: user.name,
      seed: user.seed,
      updatedAt: user.updatedAt,
      username: user.username,
    },
  });
});
