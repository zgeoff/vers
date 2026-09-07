import { expect, test } from 'bun:test';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { readQADebugHookAccess } from './read-qa-debug-hook-access';

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
