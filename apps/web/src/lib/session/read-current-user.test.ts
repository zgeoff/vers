import { expect, mock, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { userContract } from '@vers/contract-user';
import { resolveSessionContext } from '@vers/mock-services';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { SERVICE_URLS } from '../rpc/service-urls';
import { readCurrentUser } from './read-current-user';

function setupTest() {
  const mockUser = buildContractMock({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: resolveSessionContext,
  });

  return { mockUser };
}

test('it resolves null and never calls the user service when no session cookie is present', async () => {
  const ctx = setupTest();

  const getCurrentUser = mock(() => {
    throw new Error('unexpected call to getCurrentUser');
  });

  server.use(ctx.mockUser.getCurrentUser.handler(getCurrentUser));

  const outcome = await withRequestContext({}, () => readCurrentUser());

  expect(outcome.value).toBeNull();
  expect(getCurrentUser).not.toHaveBeenCalled();
});

test('it resolves the user for a signed-in session cookie', async () => {
  const signedIn = await createSignedInUser({ name: 'Read Current User' });
  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () => readCurrentUser());

  expect(outcome.value?.id).toBe(signedIn.userID);
});

test('it resolves null when the service rejects the session as unauthorized', async () => {
  const ctx = setupTest();

  const signedIn = await createSignedInUser();

  server.use(
    ctx.mockUser.getCurrentUser.handler((opts) => {
      throw opts.errors.UNAUTHORIZED({ data: { reason: 'expired-session' } });
    }),
  );

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () => readCurrentUser());

  expect(outcome.value).toBeNull();
});

test('it rejects when the service fails in a way that is not a declared unauthorized error', async () => {
  const ctx = setupTest();

  const signedIn = await createSignedInUser();

  server.use(
    ctx.mockUser.getCurrentUser.handler(() => {
      throw new Error('the user service is unreachable');
    }),
  );

  const promise = withRequestContext({ cookies: signedIn.cookies }, () => readCurrentUser());

  expect(promise).rejects.toThrow('Internal server error');
});

test('it rejects when the service declares a contract error other than unauthorized', async () => {
  const ctx = setupTest();

  const signedIn = await createSignedInUser();

  server.use(
    ctx.mockUser.getCurrentUser.handler((opts) => {
      throw opts.errors.FORBIDDEN({ data: {} });
    }),
  );

  const promise = withRequestContext({ cookies: signedIn.cookies }, () => readCurrentUser());

  expect(promise).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
