import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { pendingTransactionCollection, verificationCollection } from '../../mocks/db';
import { withRequestContext } from '../../test-utils/with-request-context';
import { verifyStepUpTransactionToken } from './step-up-transaction-token';
import { verifyStepUpHandler } from './verify-step-up-handler';

test('it records a failed attempt and reports the remaining count for an incorrect code', async () => {
  const target = createId();
  const transactionID = createId();

  await verificationCollection.create({ target, type: '2fa' });

  await pendingTransactionCollection.create({ action: 'ChangeEmail', id: transactionID });

  const outcome = await withRequestContext({}, () =>
    verifyStepUpHandler({ action: 'ChangeEmail', code: '000000', target, transactionID }),
  );

  expect(outcome.value).toStrictEqual({ attemptsRemaining: 4, status: 'invalid-code' });
});

test('it abandons the pending transaction once attempts run out', async () => {
  const target = createId();
  const transactionID = createId();

  await verificationCollection.create({ target, type: '2fa' });

  await pendingTransactionCollection.create({
    action: 'ChangeEmail',
    attempts: 4,
    id: transactionID,
  });

  const outcome = await withRequestContext({}, () =>
    verifyStepUpHandler({ action: 'ChangeEmail', code: '000000', target, transactionID }),
  );

  expect(outcome.value).toStrictEqual({ attemptsRemaining: 0, status: 'invalid-code' });

  expect(
    pendingTransactionCollection.findFirst((q) => q.where({ id: transactionID })),
  ).toBeUndefined();
});

test('it consumes the pending transaction and mints a redeemable token for a correct code', async () => {
  const target = createId();
  const transactionID = createId();

  await verificationCollection.create({ target, type: '2fa' });

  await pendingTransactionCollection.create({
    action: 'ChangePassword',
    id: transactionID,
    ipAddress: '127.0.0.1',
    sessionID: 'session-1',
    target,
  });

  const outcome = await withRequestContext(
    {
      cookies: { en_session: { accessToken: 'session-1', sessionID: 'session-1' } },
      ip: '127.0.0.1',
    },
    () => verifyStepUpHandler({ action: 'ChangePassword', code: '123456', target, transactionID }),
  );

  if (outcome.value.status !== 'verified') {
    throw new Error('expected a verified result');
  }

  const claims = await verifyStepUpTransactionToken(outcome.value.token);

  expect(claims).toMatchObject({ action: 'ChangePassword', sessionID: 'session-1', target });

  expect(
    pendingTransactionCollection.findFirst((q) => q.where({ id: transactionID })),
  ).toBeUndefined();
});

test('it rejects a correct code once the pending transaction has expired', async () => {
  const target = createId();
  const transactionID = createId();

  await verificationCollection.create({ target, type: '2fa' });

  await pendingTransactionCollection.create({
    action: 'ChangeEmail',
    expiresAt: new Date(Date.now() - 1000),
    id: transactionID,
  });

  const promise = withRequestContext({ ip: '127.0.0.1' }, () =>
    verifyStepUpHandler({ action: 'ChangeEmail', code: '123456', target, transactionID }),
  );

  expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
