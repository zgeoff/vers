import { expect, test } from 'bun:test';
import { isDefinedError, safe } from '@orpc/client';
import * as db from '@vers/mock-services/db';
import { userClient } from './user-client';

/**
 * `createIsomorphicFn`'s uncompiled fallback (this package's own bun-test run, with no Start
 * compiler pass) always resolves to the `.server()` branch — the same client instance the app
 * renders with in production. These tests prove the client-lane consumption path (typed call,
 * explicit `actingUserID` context, typed error unwrap) against the stateful mock backend for the
 * same contract the browser branch talks to through the `/api/rpc/$service` proxy.
 */
test('it reads getCurrentUser through the isomorphic client against a mocked service', async () => {
  const user = await db.userCollection.create({
    email: 'clients-test@vers.test',
    name: 'Clients Test',
    username: 'clients-test',
  });

  const result = await userClient.getCurrentUser({}, { context: { actingUserID: user.id } });

  expect(result).toStrictEqual({
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    seed: user.seed,
    updatedAt: user.updatedAt,
    username: user.username,
  });
});

test('it reports the typed UNAUTHORIZED error for a signed-out call', async () => {
  const [error, , isDefined] = await safe(
    userClient.getCurrentUser({}, { context: { actingUserID: null } }),
  );

  const isKnownError = isDefinedError(error);
  const errorData = isKnownError ? error.data : null;

  expect(isDefined).toBe(true);
  expect(isKnownError).toBe(true);
  expect(errorData).toStrictEqual({ reason: 'missing-session' });
});
