import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import * as db from '../../mocks/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { checkStepUp } from './check-step-up';
import { mintStepUpTransactionToken } from './step-up-transaction-token';

test('it reports not-needed for a caller with no 2FA enabled', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    checkStepUp({ action: 'ChangeEmail', target: signedIn.userID, token: undefined }),
  );

  expect(outcome.value).toStrictEqual({ status: 'not-needed' });
});

test('it requires a fresh pending transaction for a 2FA-enabled caller with no token', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    checkStepUp({ action: 'ChangeEmail', target: signedIn.userID, token: undefined }),
  );

  if (outcome.value.status !== 'required') {
    throw new Error('expected a required result');
  }

  const transactionID = outcome.value.transactionID;

  expect(transactionID).toBeString();

  expect(
    db.pendingTransactionCollection.findFirst((q) => q.where({ id: transactionID })),
  ).toMatchObject({ action: 'ChangeEmail', target: signedIn.userID });
});

test('it verifies a valid transaction token minted for the same action, target, and session', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangePassword',
      sessionID: signedIn.sessionID,
      target: signedIn.userID,
    });

    return checkStepUp({
      action: 'ChangePassword',
      target: signedIn.userID,
      token: minted.token,
    });
  });

  expect(outcome.value).toStrictEqual({ status: 'verified' });
});

test('it requires a new pending transaction for a token minted for a different action', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangePassword',
      sessionID: signedIn.sessionID,
      target: signedIn.userID,
    });

    return checkStepUp({
      action: 'ChangeEmail',
      target: signedIn.userID,
      token: minted.token,
    });
  });

  expect(outcome.value.status).toBe('required');
});

test('it requires a new pending transaction for a token minted under a different session', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangeEmail',
      sessionID: createId(),
      target: signedIn.userID,
    });

    return checkStepUp({
      action: 'ChangeEmail',
      target: signedIn.userID,
      token: minted.token,
    });
  });

  expect(outcome.value.status).toBe('required');
});

test('it requires a new pending transaction when the same token is replayed', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangeEmail',
      sessionID: signedIn.sessionID,
      target: signedIn.userID,
    });

    const first = await checkStepUp({
      action: 'ChangeEmail',
      target: signedIn.userID,
      token: minted.token,
    });

    const second = await checkStepUp({
      action: 'ChangeEmail',
      target: signedIn.userID,
      token: minted.token,
    });

    return { first, second };
  });

  expect(outcome.value.first).toStrictEqual({ status: 'verified' });
  expect(outcome.value.second.status).toBe('required');
});
