import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { pendingTransactionCollection } from '../../../mocks/db/pending-transaction-collection';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { verificationCollection } from '../../../mocks/db/verification-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { checkStepUp } from './check-step-up';
import { mintStepUpTransactionToken } from './step-up-transaction-token';

async function createSignedInUser(email: string): Promise<{
  readonly cookies: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly userID: string;
}> {
  const userID = createId();
  const sessionID = createId();

  await userCollection.create({
    createdAt: new Date(),
    email,
    id: userID,
    name: 'Step Up',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: email.split('@')[0] ?? 'step-up',
  });

  await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: sessionID,
    ipAddress: '127.0.0.1',
    previousRefreshToken: null,
    refreshToken: null,
    updatedAt: new Date(),
    userID,
    verified: true,
  });

  return {
    cookies: {
      en_session: { accessToken: sessionID, refreshToken: 'refresh', sessionID },
    },
    userID,
  };
}

test('it reports not-needed for a caller with no 2FA enabled', async () => {
  const signedIn = await createSignedInUser('no-2fa@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    checkStepUp({ action: 'ChangeEmail', target: signedIn.userID, token: undefined }),
  );

  expect(outcome.value).toStrictEqual({ status: 'not-needed' });
});

test('it requires a fresh pending transaction for a 2FA-enabled caller with no token', async () => {
  const signedIn = await createSignedInUser('gated@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    checkStepUp({ action: 'ChangeEmail', target: signedIn.userID, token: undefined }),
  );

  if (outcome.value.status !== 'required') {
    throw new Error('expected a required result');
  }

  const transactionID = outcome.value.transactionID;

  expect(transactionID).toBeString();

  expect(
    pendingTransactionCollection.findFirst((q) => q.where({ id: transactionID })),
  ).toMatchObject({ action: 'ChangeEmail', target: signedIn.userID });
});

test('it verifies a valid transaction token minted for the same action and target', async () => {
  const signedIn = await createSignedInUser('valid-token@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangePassword',
      sessionID: null,
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
  const signedIn = await createSignedInUser('mismatched-action@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangePassword',
      sessionID: null,
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
  const signedIn = await createSignedInUser('replay@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangeEmail',
      sessionID: null,
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
