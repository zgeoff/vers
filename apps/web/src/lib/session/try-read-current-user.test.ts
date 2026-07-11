import { expect, test } from 'bun:test';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { tryReadCurrentUser } from './try-read-current-user';

test('it reports the anon reason when there is no cookie session', async () => {
  const outcome = await withRequestContext({}, () => tryReadCurrentUser());

  expect(outcome.value).toStrictEqual({ authenticated: false, reason: 'missing-session' });
});

test('it returns the signed-in user for a live cookie session', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    tryReadCurrentUser(),
  );

  expect(outcome.value).toStrictEqual({
    authenticated: true,
    user: {
      createdAt: signedIn.user.createdAt,
      email: signedIn.user.email,
      id: signedIn.user.id,
      name: signedIn.user.name,
      seed: signedIn.user.seed,
      updatedAt: signedIn.user.updatedAt,
      username: signedIn.user.username,
    },
  });
});
