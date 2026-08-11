import { expect, spyOn, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { verificationContract } from '@vers/contract-verification';
import * as db from '@vers/mock-services/db';
import { SERVICE_URLS } from '../../lib/rpc/service-urls';
import { server } from '../../mocks/node';
import { logger } from '../../server/logger';
import { buildFormData } from '../../test-utils/build-form-data';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { verifyTwoFactorSetupHandler } from './verify-two-factor-setup-handler';

test('it reports invalid code for a malformed submission', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    verifyTwoFactorSetupHandler(buildFormData({ code: 'abc', target: signedIn.userID })),
  );

  expect(outcome.value).toStrictEqual({ formError: 'Invalid code', status: 'invalid-fields' });
});

test('it reports invalid code for an incorrect code', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({
    code: '654321',
    target: signedIn.userID,
    type: '2fa-setup',
  });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    verifyTwoFactorSetupHandler(buildFormData({ code: '000000', target: signedIn.userID })),
  );

  expect(outcome.value).toStrictEqual({
    formError: 'Invalid or expired code',
    status: 'invalid-fields',
  });
});

test('it flips the verification to 2fa and redirects to account for a correct code', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa-setup' });

  const promise = withRequestContext({ cookies: signedIn.cookies }, () =>
    verifyTwoFactorSetupHandler(buildFormData({ code: '123456', target: signedIn.userID })),
  );

  // the db read below must observe the rejected call's verification-flip step settled
  await promise.catch(() => {});

  expect(promise).rejects.toMatchObject({ options: { href: '/account' } });

  expect(
    db.verificationCollection.findFirst((q) => q.where({ target: signedIn.userID })),
  ).toMatchObject({ type: '2fa' });
});

test('it logs an unexpected code-check failure while reporting the generic form error', async () => {
  const signedIn = await createSignedInUser();

  const errorSpy = spyOn(logger, 'error');

  const mockVerification = buildContractMock({
    baseUrl: SERVICE_URLS.verification,
    contract: verificationContract,
    resolveContext: () => ({ actingUserId: null }),
  });

  server.use(
    mockVerification.verifyCode.handler(() => {
      throw new Error('the verification service is unreachable');
    }),
  );

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    verifyTwoFactorSetupHandler(buildFormData({ code: '123456', target: signedIn.userID })),
  );

  expect(outcome.value).toStrictEqual({
    formError: 'Invalid or expired code',
    status: 'invalid-fields',
  });

  expect(errorSpy).toHaveBeenCalledExactlyOnceWith(
    { err: expect.toSatisfy((value) => value instanceof Error) },
    'two-factor setup verification failed',
  );
});
