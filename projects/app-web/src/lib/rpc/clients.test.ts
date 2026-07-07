import { expect, test } from 'bun:test';
import { isDefinedError, safe } from '@orpc/client';
import { buildContractMock } from '@vers/client-test-utils/rpc-msw';
import { userContract } from '@vers/contract-user';
import { server } from '../../../mocks/node';
import { userClient } from './clients';
import { SERVICE_URLS } from './service-urls';

/**
 * `createIsomorphicFn`'s uncompiled fallback (this package's own bun-test run, with no Start
 * compiler pass) always resolves to the `.server()` branch — the same client instance the app
 * renders with in production. This proves the client-lane consumption path (typed call, forwarded
 * `context.headers`, typed error unwrap) against `mockService` overrides for the same contract the
 * browser branch talks to through the `/api/rpc/$service` proxy.
 */
const mockUser = buildContractMock({
  baseUrl: SERVICE_URLS.user,
  contract: userContract,
  resolveContext: () => ({ actingUserId: null }),
});

test('it reads getCurrentUser through the isomorphic client against a mocked service', async () => {
  const user = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    email: 'clients-test@vers.test',
    id: 'user_clients_test',
    name: 'Clients Test',
    seed: 0,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    username: 'clients-test',
  };

  server.use(mockUser.getCurrentUser.handler(user));

  const result = await userClient.getCurrentUser({}, { context: { headers: {} } });

  expect(result).toStrictEqual(user);
});

test('it surfaces the typed UNAUTHORIZED error for a signed-out call', async () => {
  server.use(
    mockUser.getCurrentUser.handler((opts) => {
      throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
    }),
  );

  const { error, isDefined } = await safe(
    userClient.getCurrentUser({}, { context: { headers: {} } }),
  );

  const isKnownError = isDefinedError(error);
  const errorData = isKnownError ? error.data : null;

  expect(isDefined).toBe(true);
  expect(isKnownError).toBe(true);
  expect(errorData).toStrictEqual({ reason: 'missing-session' });
});
