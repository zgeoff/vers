import { expect, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { userContract } from '@vers/contract-user';
import { resolveSessionContext } from '@vers/mock-services';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { SERVICE_URLS } from '../rpc/service-urls';
import { readQADebugHookAccess } from './read-qa-debug-hook-access';

function setupTest() {
  const mockUser = buildContractMock({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: resolveSessionContext,
  });

  return { mockUser };
}

test('it grants access to a signed-in account on the QA domain', async () => {
  const signedIn = await createSignedInUser({ email: 'qa+hook-1@qa.versidle.com' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    readQADebugHookAccess(),
  );

  expect(outcome.value).toBeTrue();
});

test('it refuses a signed-in account outside the QA domain', async () => {
  const signedIn = await createSignedInUser({ email: 'player@example.com' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    readQADebugHookAccess(),
  );

  expect(outcome.value).toBeFalse();
});

test('it refuses a request with no session', async () => {
  const outcome = await withRequestContext({}, () => readQADebugHookAccess());

  expect(outcome.value).toBeFalse();
});

test('it refuses, rather than rejects, when the user service fails', async () => {
  const ctx = setupTest();

  const signedIn = await createSignedInUser({ email: 'qa+hook-2@qa.versidle.com' });

  server.use(
    ctx.mockUser.getCurrentUser.handler(() => {
      throw new Error('user service unreachable');
    }),
  );

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    readQADebugHookAccess(),
  );

  expect(outcome.value).toBeFalse();
});
